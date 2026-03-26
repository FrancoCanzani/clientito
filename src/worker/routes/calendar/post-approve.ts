import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { proposedEvents } from "../../db/schema";
import { getGmailTokenForMailbox } from "../../lib/email/providers/google/client";
import { getUserMailboxes } from "../../lib/email/mailbox-state";
import { createEvent } from "../../lib/calendar/google";
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

      const rows = await db
        .select()
        .from(proposedEvents)
        .where(
          and(
            eq(proposedEvents.id, id),
            eq(proposedEvents.userId, user.id),
            eq(proposedEvents.status, "pending"),
          ),
        )
        .limit(1);

      const proposed = rows[0];
      if (!proposed) return c.json({ error: "Proposed event not found" }, 404);

      // Get a mailbox to use for Calendar API access
      const mailboxId = proposed.mailboxId;
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
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      });

      const googleEvent = await createEvent(token, {
        summary: proposed.title,
        description: proposed.description ?? undefined,
        location: proposed.location ?? undefined,
        start: { dateTime: new Date(proposed.startAt).toISOString() },
        end: { dateTime: new Date(proposed.endAt).toISOString() },
        attendees: proposed.attendees?.map((email) => ({ email })),
      });

      await db
        .update(proposedEvents)
        .set({
          status: "approved",
          googleEventId: googleEvent.id,
          updatedAt: Date.now(),
        })
        .where(eq(proposedEvents.id, id));

      return c.json(
        { data: { googleEventId: googleEvent.id, htmlLink: googleEvent.htmlLink } },
        200,
      );
    },
  );
}
