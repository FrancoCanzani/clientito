import { AsyncQueuer } from "@tanstack/pacer/async-queuer";
import { localDb } from "./client";
import type { PendingMutationPayload, PendingMutationRow } from "./schema";

type BatchItem = {
  providerMessageId: string;
  mailboxId: number;
  labelIds: string[];
};

async function sendPatch(row: PendingMutationRow): Promise<void> {
  if (row.kind === "delete") {
    await sendDelete(row);
    return;
  }

  if (row.providerMessageIds.length === 1 && row.emailIds.length === 1) {
    await sendSinglePatch(row);
    return;
  }

  await sendBatchPatch(row);
}

async function sendSinglePatch(row: PendingMutationRow): Promise<void> {
  const emailId = row.emailIds[0];
  const providerMessageId = row.providerMessageIds[0];
  if (!emailId || !providerMessageId) return;

  const response = await fetch(`/api/inbox/emails/${emailId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerMessageId,
      mailboxId: row.mailboxId,
      labelIds: row.payload.labelIds ?? [],
      ...stripLabelIds(row.payload),
    }),
  });

  if (!response.ok) {
    throw await responseError(response, "Failed to update email");
  }
}

async function sendBatchPatch(row: PendingMutationRow): Promise<void> {
  const items: BatchItem[] = row.providerMessageIds.map((pmid) => ({
    providerMessageId: pmid,
    mailboxId: row.mailboxId,
    labelIds: row.payload.labelIds ?? [],
  }));

  const response = await fetch("/api/inbox/emails/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      ...stripLabelIds(row.payload),
    }),
  });

  if (!response.ok) {
    throw await responseError(response, "Failed to update emails");
  }
}

async function sendDelete(row: PendingMutationRow): Promise<void> {
  for (let i = 0; i < row.emailIds.length; i++) {
    const emailId = row.emailIds[i];
    const providerMessageId = row.providerMessageIds[i];
    if (!emailId || !providerMessageId) continue;

    const response = await fetch(`/api/inbox/emails/${emailId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerMessageId,
        mailboxId: row.mailboxId,
      }),
    });

    if (!response.ok) {
      throw await responseError(response, "Failed to delete email");
    }
  }
}

function stripLabelIds(payload: PendingMutationPayload) {
  const { labelIds: _omit, ...rest } = payload;
  return rest;
}

async function responseError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const json = await response.json().catch(() => null);
  const message =
    json && typeof json === "object" && "error" in json && typeof json.error === "string"
      ? json.error
      : fallback;
  const err = new Error(message);
  (err as Error & { status?: number }).status = response.status;
  return err;
}

const MAX_ATTEMPTS = 5;

const queuer = new AsyncQueuer<PendingMutationRow>(
  async (row) => {
    await sendPatch(row);
    await localDb.deletePendingMutation(row.id);
  },
  {
    concurrency: 1,
    started: true,
    asyncRetryerOptions: {
      maxAttempts: MAX_ATTEMPTS,
      backoff: "exponential",
      baseWait: 1000,
      maxWait: 30_000,
      jitter: 0.2,
    },
    onError: (error, row) => {
      const message = error instanceof Error ? error.message : String(error);
      void localDb
        .markPendingMutationFailed(row.id, MAX_ATTEMPTS, message)
        .catch(() => {});
      console.warn("[mutation-queue] permanent failure", {
        id: row.id,
        kind: row.kind,
        message,
      });
    },
  },
);

export async function enqueueMutation(row: PendingMutationRow): Promise<void> {
  await localDb.insertPendingMutation(row);
  queuer.addItem(row);
}

let replayed = false;

export async function replayPendingMutations(userId: string): Promise<void> {
  if (replayed) return;
  replayed = true;
  const rows = await localDb.listPendingMutations(userId).catch(() => []);
  for (const row of rows) {
    queuer.addItem(row);
  }
}

export function resetMutationQueue(): void {
  queuer.clear();
  replayed = false;
}
