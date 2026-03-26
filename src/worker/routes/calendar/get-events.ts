import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, lte } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { proposedEvents } from "../../db/schema";
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
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
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

    // Fetch pending proposed events
    const proposed = await db
      .select()
      .from(proposedEvents)
      .where(
        and(
          eq(proposedEvents.userId, user.id),
          eq(proposedEvents.status, "pending"),
          gte(proposedEvents.startAt, fromMs),
          lte(proposedEvents.startAt, toMs),
        ),
      );

    const proposedAgenda: AgendaEvent[] = proposed.map((p) => ({
      id: `proposed-${p.id}`,
      source: "proposed",
      title: p.title,
      startAt: p.startAt,
      endAt: p.endAt,
      location: p.location ?? undefined,
      isAllDay: false,
      status: "pending",
      proposedId: p.id,
      emailId: p.emailId ?? undefined,
      description: p.description ?? undefined,
    }));

    // Merge and sort chronologically
    const allEvents = [...googleEvents, ...proposedAgenda].sort(
      (a, b) => a.startAt - b.startAt,
    );

    return c.json({ data: allEvents }, 200);
  });
}
