import type { CalendarInviteResponseStatus } from "./ics";

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary";

type GoogleCalendarEventAttendee = {
  email?: string;
  self?: boolean;
  responseStatus?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  iCalUID?: string;
  status?: string;
  attendees?: GoogleCalendarEventAttendee[];
};

type GoogleCalendarEventsListResponse = {
  items?: GoogleCalendarEvent[];
};

async function calendarRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Calendar request failed (${response.status}): ${body || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export function normalizeCalendarResponseStatus(
  value: string | null | undefined,
): CalendarInviteResponseStatus | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "accepted") return "accepted";
  if (normalized === "declined") return "declined";
  if (normalized === "tentative") return "tentative";
  if (normalized === "needsaction") return "needsAction";
  return null;
}

export function getSelfResponseStatus(
  event: GoogleCalendarEvent,
  selfEmail?: string | null,
): CalendarInviteResponseStatus | null {
  const attendees = event.attendees ?? [];
  const normalizedSelf = selfEmail?.trim().toLowerCase() ?? null;
  const selfAttendee =
    attendees.find((attendee) => attendee.self) ??
    (normalizedSelf
      ? attendees.find(
          (attendee) => attendee.email?.trim().toLowerCase() === normalizedSelf,
        )
      : undefined);

  return normalizeCalendarResponseStatus(selfAttendee?.responseStatus);
}

export async function findPrimaryCalendarEventByIcalUid(
  accessToken: string,
  inviteUid: string,
): Promise<GoogleCalendarEvent | null> {
  const path = `/events?iCalUID=${encodeURIComponent(inviteUid)}&maxResults=10`;
  const payload = await calendarRequest<GoogleCalendarEventsListResponse>(
    accessToken,
    path,
  );
  const events = payload.items ?? [];
  if (events.length === 0) return null;

  const activeEvent = events.find((event) => event.status !== "cancelled");
  return activeEvent ?? events[0] ?? null;
}

export async function setPrimaryCalendarResponseStatus(params: {
  accessToken: string;
  event: GoogleCalendarEvent;
  responseStatus: "accepted" | "declined";
  selfEmail?: string | null;
}): Promise<GoogleCalendarEvent> {
  const attendees = [...(params.event.attendees ?? [])];
  const normalizedSelf = params.selfEmail?.trim().toLowerCase() ?? null;

  const targetIndex = attendees.findIndex((attendee) => {
    if (attendee.self) return true;
    if (!normalizedSelf) return false;
    return attendee.email?.trim().toLowerCase() === normalizedSelf;
  });

  if (targetIndex >= 0) {
    const current = attendees[targetIndex]!;
    attendees[targetIndex] = {
      ...current,
      responseStatus: params.responseStatus,
    };
  } else if (params.selfEmail) {
    attendees.push({
      email: params.selfEmail,
      responseStatus: params.responseStatus,
    });
  } else {
    throw new Error("Unable to determine attendee for this mailbox.");
  }

  return calendarRequest<GoogleCalendarEvent>(
    params.accessToken,
    `/events/${encodeURIComponent(params.event.id)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendees }),
    },
  );
}
