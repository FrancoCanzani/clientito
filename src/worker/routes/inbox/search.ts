import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import {
  getGmailTokenForMailbox,
  listThreadsPage,
} from "../../lib/gmail/client";
import { resolveMailbox } from "../../lib/gmail/mailboxes";
import { fetchThreadsAndParse } from "../../lib/gmail/sync/threads";
import type { AppRouteEnv } from "../types";

const SEARCH_BATCH_SIZE = 10;

const searchRequestSchema = z.object({
  mailboxId: z.number().int().positive(),
  q: z.string().min(1).max(500),
  pageToken: z.string().optional(),
  includeJunk: z.boolean().optional(),
});

export function registerInboxSearch(api: Hono<AppRouteEnv>) {
  api.post(
    "/search",
    zValidator("json", searchRequestSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { mailboxId, q, pageToken, includeJunk } = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) {
        return c.json({ error: "No mailbox found" }, 400);
      }

      const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      });

      const page = await listThreadsPage(accessToken, {
        pageToken,
        query: q,
        maxResults: SEARCH_BATCH_SIZE,
        includeSpamTrash: includeJunk ?? false,
      });
      const threadIds = (page.threads ?? []).map((t) => t.id);

      const emails = await fetchThreadsAndParse(accessToken, threadIds, null);

      return c.json({
        emails,
        deleted: [] as string[],
        cursor: page.nextPageToken ?? null,
      });
    },
  );
}
