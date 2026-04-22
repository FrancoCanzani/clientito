import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { parseCalendarInviteFromIcs } from "../../../lib/calendar/ics";
import { isGmailReconnectRequiredError } from "../../../lib/gmail/errors";
import { GmailDriver } from "../../../lib/gmail/driver";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../../types";
import { previewCalendarInviteSchema } from "./schemas";

const CALENDAR_MIME_PREFIXES = [
  "text/calendar",
  "application/ics",
  "application/icalendar",
  "application/x-ical",
  "application/vnd.ms-outlook",
] as const;

function isCalendarMimeType(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return CALENDAR_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isCalendarFilename(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase().endsWith(".ics");
}

function extractCalendarBlob(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/i);
  return match?.[0] ?? null;
}

export function registerPreviewCalendarInvite(api: Hono<AppRouteEnv>) {
  api.post(
    "/preview",
    zValidator("json", previewCalendarInviteSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { mailboxId, providerMessageId } = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

      const driver = new GmailDriver(db, c.env, mailbox.id);

      try {
        const message = await driver.fetchMessage(providerMessageId);

        for (const attachment of message.attachments) {
          if (!attachment.attachmentId) continue;
          if (
            !isCalendarMimeType(attachment.mimeType) &&
            !isCalendarFilename(attachment.filename)
          ) {
            continue;
          }

          try {
            const bytes = await driver.fetchAttachment(
              providerMessageId,
              attachment.attachmentId,
            );
            const inviteText = new TextDecoder().decode(bytes);
            const invite = parseCalendarInviteFromIcs(inviteText, mailbox.email);
            if (invite) {
              return c.json({ data: { invite } }, 200);
            }
          } catch (error) {
            console.warn("Failed to parse invite attachment", {
              providerMessageId,
              attachmentId: attachment.attachmentId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const bodyCandidates = [
          extractCalendarBlob(message.bodyText),
          extractCalendarBlob(
            message.bodyHtml?.replace(/<[^>]+>/g, " ") ?? message.bodyHtml,
          ),
        ];
        for (const candidate of bodyCandidates) {
          if (!candidate) continue;
          const invite = parseCalendarInviteFromIcs(candidate, mailbox.email);
          if (invite) return c.json({ data: { invite } }, 200);
        }

        return c.json({ data: { invite: null } }, 200);
      } catch (error) {
        if (isGmailReconnectRequiredError(error)) {
          return c.json(
            { error: "Provider connection expired. Sign in again." },
            401,
          );
        }

        console.warn("Calendar invite preview failed", {
          providerMessageId,
          error: error instanceof Error ? error.message : String(error),
        });
        return c.json({ error: "Failed to read calendar invite." }, 502);
      }
    },
  );
}
