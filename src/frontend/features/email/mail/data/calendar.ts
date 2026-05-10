import type { CalendarInvitePreview } from "@/features/email/mail/types";

export async function fetchCalendarInvitePreview(params: {
  mailboxId: number;
  providerMessageId: string;
}): Promise<CalendarInvitePreview | null> {
  const response = await fetch("/api/inbox/calendar/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId: params.mailboxId,
      providerMessageId: params.providerMessageId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    data?: { invite?: CalendarInvitePreview | null };
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load calendar invite preview");
  }

  return payload?.data?.invite ?? null;
}
