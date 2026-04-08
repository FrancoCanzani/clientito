import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Database } from "../../../db/client";
import {
  getMailboxSyncSnapshot,
  resolveMailbox,
} from "../../../lib/gmail/sync/state";
import { catchUpMailboxOnDemand } from "../../../lib/gmail/sync/engine";
import type { AppRouteEnv } from "../../types";
import { syncRequestSchema } from "./schemas";

async function isSyncInProgress(db: Database, mailboxId: number): Promise<boolean> {
  const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
  return snapshot.hasLiveLock;
}

export function registerPostSync(api: Hono<AppRouteEnv>) {
  api.post("/start", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { months, mailboxId } = c.req.valid("json");
    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (mailbox && await isSyncInProgress(db, mailbox.id)) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    await c.env.SYNC_QUEUE.send({
      type: "full-sync" as const,
      userId: user.id,
      mailboxId,
      months,
    });

    return c.json({ status: "started" }, 202);
  });

  api.post("/incremental", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { mailboxId } = c.req.valid("json");
    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) {
      return c.json({ error: "No mailbox found" }, 400);
    }

    const result = await catchUpMailboxOnDemand(
      db, c.env, mailbox.id, user.id, { force: true },
    );

    if (result.status === "skipped" && result.reason === "sync_in_progress") {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    if (result.status === "failed") {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ status: result.status }, 200);
  });

  api.post("/recover", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const mailbox = await resolveMailbox(db, user.id);
    if (!mailbox) {
      return c.json({ error: "No mailbox found" }, 400);
    }

    await c.env.SYNC_QUEUE.send({
      type: "recover-sync" as const,
      userId: user.id,
      mailboxId: mailbox.id,
    });

    return c.json({ status: "started" }, 202);
  });
}
