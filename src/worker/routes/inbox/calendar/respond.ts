import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import {
  findPrimaryCalendarEventByIcalUid,
  getSelfResponseStatus,
  setPrimaryCalendarResponseStatus,
} from "../../../lib/calendar/google";
import { isGmailReconnectRequiredError } from "../../../lib/gmail/errors";
import { getGmailTokenForMailbox } from "../../../lib/gmail/client";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../../types";
import { respondCalendarInviteSchema } from "./schemas";

export function registerRespondCalendarInvite(api: Hono<AppRouteEnv>) {
  api.post(
    "/respond",
    zValidator("json", respondCalendarInviteSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { mailboxId, inviteUid, response } = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      try {
        const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
          GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
        });

        const event = await findPrimaryCalendarEventByIcalUid(
          accessToken,
          inviteUid,
        );
        if (!event) return c.json({ error: "Calendar event not found." }, 404);

        const updated = await setPrimaryCalendarResponseStatus({
          accessToken,
          event,
          responseStatus: response,
          selfEmail: mailbox.email,
        });
        const selfResponseStatus = getSelfResponseStatus(updated, mailbox.email);

        return c.json(
          {
            data: {
              inviteUid,
              responseStatus: response,
              selfResponseStatus,
            },
          },
          200,
        );
      } catch (error) {
        if (isGmailReconnectRequiredError(error)) {
          return c.json(
            { error: "Provider connection expired. Sign in again." },
            401,
          );
        }

        console.warn("Calendar invite response failed", {
          inviteUid,
          response,
          error: error instanceof Error ? error.message : String(error),
        });
        return c.json({ error: "Failed to update invite response." }, 502);
      }
    },
  );
}
