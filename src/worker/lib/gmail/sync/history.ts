import {
  GmailHistoryStaleError,
  listGmailHistory,
  type GmailHistoryListResponse,
} from "../client";
import { fetchThreadsAndParse } from "./threads";
import type { ParsedEmail } from "./parse";

export const HISTORY_METADATA_HEADERS = [
  "From",
  "To",
  "Cc",
  "Subject",
  "Date",
  "Message-ID",
  "In-Reply-To",
  "References",
  "Reply-To",
  "List-Unsubscribe",
];

const MAX_HISTORY_PAGES = 25;
const MAX_AFFECTED_THREADS_BEFORE_STALE = 2_000;

export type DeltaLabelChange = {
  providerMessageId: string;
  addedLabels: string[];
  removedLabels: string[];
};

export type DeltaSyncResult = {
  status: "ok";
  added: ParsedEmail[];
  deleted: string[];
  labelChanges: DeltaLabelChange[];
  newHistoryId: string;
};

export type DeltaSyncOutcome =
  | DeltaSyncResult
  | { status: "stale"; newHistoryId: string | null }
  | { status: "noop"; newHistoryId: string };

function mergeLabelArrays(target: Set<string>, ids?: string[]): void {
  if (!ids) return;
  for (const id of ids) target.add(id);
}

export async function pullDeltaSync(
  accessToken: string,
  startHistoryId: string,
): Promise<DeltaSyncOutcome> {
  const affectedThreadIds = new Set<string>();
  const deletedMessageIds = new Set<string>();
  const labelAdditions = new Map<string, Set<string>>();
  const labelRemovals = new Map<string, Set<string>>();

  let pageToken: string | undefined;
  let pages = 0;
  let highestHistoryId: string = startHistoryId;

  try {
    do {
      const response: GmailHistoryListResponse = await listGmailHistory(
        accessToken,
        {
          startHistoryId,
          pageToken,
          historyTypes: [
            "messageAdded",
            "messageDeleted",
            "labelAdded",
            "labelRemoved",
          ],
        },
      );

      if (response.historyId) {
        highestHistoryId = response.historyId;
      }

      for (const entry of response.history ?? []) {
        for (const added of entry.messagesAdded ?? []) {
          const threadId = added.message?.threadId;
          if (threadId) affectedThreadIds.add(threadId);
        }
        for (const removed of entry.messagesDeleted ?? []) {
          const messageId = removed.message?.id;
          if (messageId) deletedMessageIds.add(messageId);
        }
        for (const labelAdd of entry.labelsAdded ?? []) {
          const messageId = labelAdd.message?.id;
          if (!messageId) continue;
          let bucket = labelAdditions.get(messageId);
          if (!bucket) {
            bucket = new Set();
            labelAdditions.set(messageId, bucket);
          }
          mergeLabelArrays(bucket, labelAdd.labelIds);
          // A label add can move a message into a visible view; refetch the
          // thread so its header/snippet appears in the list.
          const threadId = labelAdd.message?.threadId;
          if (threadId) affectedThreadIds.add(threadId);
        }
        for (const labelRemove of entry.labelsRemoved ?? []) {
          const messageId = labelRemove.message?.id;
          if (!messageId) continue;
          let bucket = labelRemovals.get(messageId);
          if (!bucket) {
            bucket = new Set();
            labelRemovals.set(messageId, bucket);
          }
          mergeLabelArrays(bucket, labelRemove.labelIds);
        }
      }

      pageToken = response.nextPageToken;
      pages += 1;

      if (
        affectedThreadIds.size > MAX_AFFECTED_THREADS_BEFORE_STALE ||
        (pages >= MAX_HISTORY_PAGES && pageToken)
      ) {
        return { status: "stale", newHistoryId: highestHistoryId };
      }
    } while (pageToken);
  } catch (error) {
    if (error instanceof GmailHistoryStaleError) {
      return { status: "stale", newHistoryId: null };
    }
    throw error;
  }

  if (
    affectedThreadIds.size === 0 &&
    deletedMessageIds.size === 0 &&
    labelAdditions.size === 0 &&
    labelRemovals.size === 0
  ) {
    return { status: "noop", newHistoryId: highestHistoryId };
  }

  let added: ParsedEmail[] = [];
  if (affectedThreadIds.size > 0) {
    added = await fetchThreadsAndParse(
      accessToken,
      Array.from(affectedThreadIds),
      null,
      {
        format: "metadata",
        metadataHeaders: HISTORY_METADATA_HEADERS,
      },
    );
    if (deletedMessageIds.size > 0) {
      added = added.filter((m) => !deletedMessageIds.has(m.providerMessageId));
    }
  }

  const labelChanges: DeltaLabelChange[] = [];
  const labelChangeIds = new Set<string>([
    ...labelAdditions.keys(),
    ...labelRemovals.keys(),
  ]);
  for (const id of labelChangeIds) {
    if (deletedMessageIds.has(id)) continue;
    labelChanges.push({
      providerMessageId: id,
      addedLabels: Array.from(labelAdditions.get(id) ?? []),
      removedLabels: Array.from(labelRemovals.get(id) ?? []),
    });
  }

  return {
    status: "ok",
    added,
    deleted: Array.from(deletedMessageIds),
    labelChanges,
    newHistoryId: highestHistoryId,
  };
}
