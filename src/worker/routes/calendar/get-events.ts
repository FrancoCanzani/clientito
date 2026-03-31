import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { emailIntelligence } from "../../db/schema";
import { getGmailTokenForMailbox } from "../../lib/email/providers/google/client";
import { getUserMailboxes } from "../../lib/email/mailbox-state";
import { listEvents, type GoogleCalendarEvent } from "../../lib/calendar/google";
import type { AppRouteEnv } from "../types";

const querySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

type AgendaEvent = {
  id: string;
  source: "google" | "proposed";
  title: string;
  startAt: number;
  endAt: number;
  location?: string;
  isAllDay: boolean;
  status: "confirmed" | "pending";
  htmlLink?: string;
  proposedId?: number;
  emailId?: number;
  description?: string;
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
    const { from, to } = c.req.valid("query");

    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();

    // Fetch Google Calendar events from all mailboxes
    const mailboxes = await getUserMailboxes(db, user.id);
    const googleEvents: AgendaEvent[] = [];

    for (const mb of mailboxes) {
      if (!mb.historyId || mb.authState !== "ok") continue;
      try {
        const token = await getGmailTokenForMailbox(db, mb.id, {
          GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
        });
        const events = await listEvents(token, from, to);
        googleEvents.push(...events.map(googleEventToAgenda));
      } catch (error) {
        console.error("Failed to fetch calendar events", {
          mailboxId: mb.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const intelligenceRows = await db
      .select({
        emailId: emailIntelligence.emailId,
        calendarEventsJson: emailIntelligence.calendarEventsJson,
      })
      .from(emailIntelligence)
      .where(eq(emailIntelligence.userId, user.id));

    const proposedAgenda: AgendaEvent[] = intelligenceRows.flatMap((row) =>
      (row.calendarEventsJson ?? [])
        .filter(
          (event) =>
            event.status === "pending" &&
            event.startAt >= fromMs &&
            event.startAt <= toMs,
        )
        .map((event) => ({
          id: `proposed-${event.id}`,
          source: "proposed" as const,
          title: event.title,
          startAt: event.startAt,
          endAt: event.endAt,
          location: event.location ?? undefined,
          isAllDay: event.isAllDay,
          status: "pending" as const,
          proposedId: event.id,
          emailId: row.emailId,
          description: event.sourceText,
        })),
    );

    // Merge and sort chronologically
    const allEvents = [...googleEvents, ...proposedAgenda].sort(
      (a, b) => a.startAt - b.startAt,
    );

    return c.json({ data: allEvents }, 200);
  });
}
