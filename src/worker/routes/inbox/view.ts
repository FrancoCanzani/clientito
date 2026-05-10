import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { getUser } from "../../middleware/auth";
import { mailboxes } from "../../db/schema";
import {
  getGmailTokenForMailbox,
  listThreadsPage,
} from "../../lib/gmail/client";
import { handleGmailError } from "../../lib/gmail/errors";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import { fetchThreadsAndParse } from "../../lib/gmail/sync/threads";
import { viewToGmailFilter } from "../../lib/gmail/view-filter";
import type { AppRouteEnv } from "../types";

const VIEW_PAGE_DEFAULT_THREADS = 25;
const VIEW_PAGE_MAX_THREADS = 100;

const viewPageRequestSchema = z.object({
  mailboxId: z.number().int().positive(),
  view: z.string().min(1).max(120),
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(VIEW_PAGE_MAX_THREADS).optional(),
  beforeMs: z.number().int().positive().optional(),
  filters: z
    .object({
      unread: z.boolean().optional(),
      starred: z.boolean().optional(),
      hasAttachment: z.boolean().optional(),
    })
    .optional(),
});

function appendQueryClauses(
  query: string | undefined,
  clauses: string[],
): string {
  const parts = [query, ...clauses].filter((p): p is string => Boolean(p && p.length > 0));
  return parts.join(" ");
}

const viewRoutes = (api: Hono<AppRouteEnv>) => {
  api.post("/page", zValidator("json", viewPageRequestSchema), async (c) => {
    const db = c.get("db");
    const user = getUser(c);
    const { mailboxId, view, cursor, limit, beforeMs, filters } = c.req.valid("json");

    const filter = viewToGmailFilter(view);
    if (!filter) {
      return c.json({ emails: [], cursor: null });
    }

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "No mailbox found" }, 400);

    const extraClauses: string[] = [];
    if (beforeMs != null) extraClauses.push(`before:${Math.floor(beforeMs / 1000)}`);
    if (filters?.unread) extraClauses.push("is:unread");
    if (filters?.starred) extraClauses.push("is:starred");
    if (filters?.hasAttachment) extraClauses.push("has:attachment");
    const effectiveQuery = appendQueryClauses(filter.query, extraClauses);

    try {
      const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      });

      const page = await listThreadsPage(accessToken, {
        pageToken: cursor,
        query: effectiveQuery,
        labelIds: filter.labelIds,
        maxResults: limit ?? VIEW_PAGE_DEFAULT_THREADS,
      });

      const threadIds = (page.threads ?? []).map((t) => t.id);
      const emails = await fetchThreadsAndParse(accessToken, threadIds, null);

      if (mailbox.authState !== "ok" || mailbox.lastErrorMessage) {
        await db
          .update(mailboxes)
          .set({
            authState: "ok",
            lastErrorAt: null,
            lastErrorMessage: null,
            updatedAt: Date.now(),
          })
          .where(eq(mailboxes.id, mailbox.id));
      }

      return c.json({
        emails,
        cursor: page.nextPageToken ?? null,
      });
    } catch (error) {
      const handled = handleGmailError(error, db, mailbox.id, c);
      if (handled) return handled;
      throw error;
    }
  });
};

export default viewRoutes;
