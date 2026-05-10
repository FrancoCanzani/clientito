export function normalizeEmailAddress(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const bracketMatch = normalized.match(/<([^>]+)>/);
  const candidate = bracketMatch?.[1]?.trim() ?? normalized;
  const emailMatch = candidate.match(/[^\s<>()"'`,;:]+@[^\s<>()"'`,;:]+/);
  return emailMatch?.[0]?.toLowerCase() ?? null;
}

export const CALENDAR_MIME_PREFIXES = [
  "text/calendar",
  "application/ics",
  "application/icalendar",
  "application/x-ical",
  "application/vnd.ms-outlook",
] as const;

export const CALENDAR_BODY_MARKERS = [
  "begin:vcalendar",
  "begin:vevent",
  "method:request",
  "method:cancel",
  "method:reply",
] as const;

export function isCalendarMimeType(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return CALENDAR_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isCalendarFilename(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  return value.trim().toLowerCase().endsWith(".ics");
}

export function hasCalendarBodySignal(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return CALENDAR_BODY_MARKERS.some((marker) => normalized.includes(marker));
}