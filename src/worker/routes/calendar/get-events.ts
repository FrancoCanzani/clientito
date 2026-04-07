import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import {
  listEvents,
  type GoogleCalendarEvent,
} from "../../lib/calendar/google";
import { getUserMailboxes } from "../../lib/email/mailbox-state";
import { getGmailTokenForMailbox } from "../../lib/email/providers/google/client";
import type { AppRouteEnv } from "../types";

const querySchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  mailboxId: z.coerce.number().int().positive(),
});

type AgendaEvent = {
  id: string;
  source: "google";
  mailboxId?: number | null;
  title: string;
  startAt: number;
  endAt: number;
  location?: string;
  isAllDay: boolean;
  status: "confirmed";
  htmlLink?: string;
};

function googleEventToAgenda(event: GoogleCalendarEvent): AgendaEvent {
  const isAllDay = !event.start.dateTime;
  const startAt = isAllDay
    ? new Date(event.start.date!).getTime()
    : new Date(event.start.dateTime!).getTime();
  const endAt = isAllDay
    ? new Date(event.end.date!).getTime()
    : new Date(event.end.dateTime!).getTime();

  return {
    id: `google-${event.id}`,
    source: "google",
    title: event.summary || "(No title)",
    startAt,
    endAt,
    location: event.location,
    isAllDay,
    status: "confirmed",
    htmlLink: event.htmlLink,
  };
}

export function registerGetCalendarEvents(api: Hono<AppRouteEnv>) {
  api.get("/events", zValidator("query", querySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const env = c.env;
    const { from, to, mailboxId } = c.req.valid("query");

    const mailboxes = await getUserMailboxes(db, user.id);
    const activeMailbox = mailboxes.find((mailbox) => mailbox.id === mailboxId);
    if (!activeMailbox) {
      return c.json({ error: "Mailbox not found" }, 404);
    }

    const googleEvents: AgendaEvent[] = [];

    if (activeMailbox.historyId && activeMailbox.authState === "ok") {
      try {
        const token = await getGmailTokenForMailbox(db, activeMailbox.id, {
          GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
        });
        const events = await listEvents(token, from, to);
        googleEvents.push(
          ...events.map((event) => ({
            ...googleEventToAgenda(event),
            mailboxId: activeMailbox.id,
          })),
        );
      } catch (error) {
        console.error("Failed to fetch calendar events", {
          mailboxId: activeMailbox.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return c.json(googleEvents.sort((a, b) => a.startAt - b.startAt), 200);
  });
}
