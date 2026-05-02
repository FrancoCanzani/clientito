import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import {
  getGmailTokenForMailbox,
  listThreadsPage,
} from "../../lib/gmail/client";
import { isGmailRateLimitError } from "../../lib/gmail/errors";
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
});

function appendBeforeClause(query: string | undefined, beforeMs: number): string {
  const seconds = Math.floor(beforeMs / 1000);
  const clause = `before:${seconds}`;
  return query && query.length > 0 ? `${query} ${clause}` : clause;
}

const viewRoutes = (api: Hono<AppRouteEnv>) => {
  api.post("/page", zValidator("json", viewPageRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { mailboxId, view, cursor, limit, beforeMs } = c.req.valid("json");

    const filter = viewToGmailFilter(view);
    if (!filter) {
      return c.json({ emails: [], cursor: null });
    }

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "No mailbox found" }, 400);

    const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
      GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
    });

    const effectiveQuery =
      beforeMs != null ? appendBeforeClause(filter.query, beforeMs) : filter.query;

    try {
      const page = await listThreadsPage(accessToken, {
        pageToken: cursor,
        query: effectiveQuery,
        labelIds: filter.labelIds,
        maxResults: limit ?? VIEW_PAGE_DEFAULT_THREADS,
      });

      const threadIds = (page.threads ?? []).map((t) => t.id);
      const emails = await fetchThreadsAndParse(accessToken, threadIds, null);

      return c.json({
        emails,
        cursor: page.nextPageToken ?? null,
      });
    } catch (error) {
      if (isGmailRateLimitError(error)) {
        c.header("Retry-After", "60");
        return c.json({ error: "gmail_rate_limited" }, 429);
      }
      throw error;
    }
  });
};

export default viewRoutes;
