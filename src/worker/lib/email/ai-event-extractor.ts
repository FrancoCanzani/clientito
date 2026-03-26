import { Output, generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import type { Database } from "../../db/client";
import { proposedEvents } from "../../db/schema";
import { withRetry } from "../utils";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

type EmailForEventExtraction = {
  emailId: number;
  mailboxId: number;
  from: string;
  fromName?: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText?: string | null;
  date: number;
};

const extractedEventSchema = z.object({
  events: z.array(
    z.object({
      emailIndex: z.number(),
      title: z.string(),
      description: z.string().optional(),
      location: z.string().optional(),
      startAt: z.string(),
      endAt: z.string(),
      attendees: z.array(z.string()).optional(),
    }),
  ),
});

function compactText(
  value: string | null | undefined,
  maxLength: number,
): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export async function extractEventsFromEmails(
  ai: Ai,
  db: Database,
  userId: string,
  emailBatch: EmailForEventExtraction[],
): Promise<number> {
  if (emailBatch.length === 0) return 0;

  const workersAI = createWorkersAI({ binding: ai });
  const now = Date.now();
  const todayStr = new Date(now).toISOString().slice(0, 10);

  const emailList = emailBatch
    .map(
      (email, i) =>
        [
          `[${i}]`,
          `From: ${email.fromName ? `${email.fromName} <${email.from}>` : email.from}`,
          `Date: ${new Date(email.date).toISOString()}`,
          `Subject: ${email.subject ?? "(no subject)"}`,
          `Preview: ${compactText(email.snippet, 200) || "(empty)"}`,
          `Body excerpt: ${compactText(email.bodyText, 400) || "(empty)"}`,
        ].join(" | "),
    )
    .join("\n");

  try {
    const { output } = await withRetry(
      () => generateText({
      model: workersAI(MODEL),
      output: Output.object({ schema: extractedEventSchema }),
      prompt: `Today is ${todayStr}. Extract calendar events from the emails below.

Only extract events that have a clear date/time mentioned. Do not invent events.
Look for: meetings, calls, appointments, demos, interviews, deadlines with specific times, reservations, flights.
Do NOT extract vague references like "let's meet sometime" or "we should catch up".

For each event found, return:
- emailIndex: the number in brackets
- title: short event title
- description: brief context from the email
- location: if mentioned (meeting link, address, etc.)
- startAt: ISO 8601 datetime string (use the email's timezone context if available, otherwise UTC)
- endAt: ISO 8601 datetime string (if no duration mentioned, assume 1 hour)
- attendees: email addresses of participants if mentioned

If no events are found in any email, return an empty events array.

Emails:
${emailList}`,
    }),
      { maxRetries: 1, baseDelayMs: 2000, label: "event-extraction" },
    );

    if (!output.events || output.events.length === 0) return 0;

    let inserted = 0;
    for (const event of output.events) {
      const email = emailBatch[event.emailIndex];
      if (!email) continue;

      const startAt = new Date(event.startAt).getTime();
      const endAt = new Date(event.endAt).getTime();

      // Skip events with invalid dates or in the past
      if (Number.isNaN(startAt) || Number.isNaN(endAt) || startAt < now) {
        continue;
      }

      await db.insert(proposedEvents).values({
        userId,
        mailboxId: email.mailboxId,
        emailId: email.emailId,
        title: event.title.slice(0, 200),
        description: event.description?.slice(0, 2000) ?? null,
        location: event.location?.slice(0, 500) ?? null,
        startAt,
        endAt,
        attendees: event.attendees ?? null,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }

    return inserted;
  } catch (error) {
    console.error("Event extraction failed", error);
    return 0;
  }
}
