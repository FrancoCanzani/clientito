import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { getGmailTokenForMailbox } from "../../lib/email/providers/google/client";
import { getUserMailboxes } from "../../lib/email/mailbox-state";
import { createEvent } from "../../lib/calendar/google";
import {
  findCalendarSuggestionById,
  updateCalendarSuggestion,
} from "../../lib/email/intelligence/store";
import type { AppRouteEnv } from "../types";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function registerPostApproveProposed(api: Hono<AppRouteEnv>) {
  api.post(
    "/proposed/:id/approve",
    zValidator("param", paramsSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const env = c.env;
      const { id } = c.req.valid("param");

      const match = await findCalendarSuggestionById(db, user.id, id);
      if (!match || match.suggestion.status !== "pending") {
        return c.json({ error: "Proposed event not found" }, 404);
      }

      const mailboxId = match.row.mailboxId;
      let mbId: number;

      if (mailboxId) {
        mbId = mailboxId;
      } else {
        const mailboxes = await getUserMailboxes(db, user.id);
        const usable = mailboxes.find(
          (mb) => mb.historyId && mb.authState === "ok",
        );
        if (!usable) {
          return c.json({ error: "No connected account available" }, 400);
        }
        mbId = usable.id;
      }

      const token = await getGmailTokenForMailbox(db, mbId, {
        GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
      });

      const start = match.suggestion.isAllDay
        ? { date: new Date(match.suggestion.startAt).toISOString().slice(0, 10) }
        : { dateTime: new Date(match.suggestion.startAt).toISOString() };
      const end = match.suggestion.isAllDay
        ? { date: new Date(match.suggestion.endAt).toISOString().slice(0, 10) }
        : { dateTime: new Date(match.suggestion.endAt).toISOString() };

      const googleEvent = await createEvent(token, {
        summary: match.suggestion.title,
        description: match.suggestion.sourceText,
        location: match.suggestion.location ?? undefined,
        start,
        end,
        attendees: match.suggestion.attendees?.map((email) => ({ email })),
      });

      await updateCalendarSuggestion(db, match, {
        status: "approved",
        googleEventId: googleEvent.id,
      });

      return c.json(
        { data: { googleEventId: googleEvent.id, htmlLink: googleEvent.htmlLink } },
        200,
      );
    },
  );
}
