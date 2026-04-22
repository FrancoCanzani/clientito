export type CalendarInviteResponseStatus =
  | "needsAction"
  | "accepted"
  | "declined"
  | "tentative";

export type ParsedCalendarInvite = {
  uid: string;
  method: string | null;
  status: string | null;
  title: string | null;
  location: string | null;
  organizerEmail: string | null;
  startMs: number | null;
  endMs: number | null;
  startRaw: string | null;
  endRaw: string | null;
  timezone: string | null;
  selfResponseStatus: CalendarInviteResponseStatus | null;
};

type ParsedProperty = {
  name: string;
  params: Record<string, string>;
  value: string;
};

function unfoldIcsLines(input: string): string {
  return input.replace(/\r?\n[ \t]/g, "");
}

function parseProperty(line: string): ParsedProperty | null {
  const separator = line.indexOf(":");
  if (separator <= 0) return null;

  const left = line.slice(0, separator).trim();
  const value = line.slice(separator + 1).trim();
  if (!left) return null;

  const [rawName, ...rawParams] = left.split(";");
  if (!rawName) return null;

  const params: Record<string, string> = {};
  for (const entry of rawParams) {
    const equals = entry.indexOf("=");
    if (equals <= 0) continue;
    const key = entry.slice(0, equals).trim().toUpperCase();
    const paramValue = entry.slice(equals + 1).trim().replace(/^"|"$/g, "");
    if (!key || !paramValue) continue;
    params[key] = paramValue;
  }

  return {
    name: rawName.trim().toUpperCase(),
    params,
    value,
  };
}

function decodeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractMailtoAddress(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const match = normalized.match(/^mailto:(.+)$/i);
  const raw = match?.[1] ?? normalized;
  const cleaned = raw.trim().replace(/^<|>$/g, "");
  return cleaned || null;
}

function parsePartStat(
  value: string | undefined,
): CalendarInviteResponseStatus | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "ACCEPTED") return "accepted";
  if (normalized === "DECLINED") return "declined";
  if (normalized === "TENTATIVE") return "tentative";
  if (normalized === "NEEDS-ACTION") return "needsAction";
  return null;
}

function parseIcsDate(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const match = normalized.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/,
  );
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, zRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw ?? "0");
  const minute = Number(minuteRaw ?? "0");
  const second = Number(secondRaw ?? "0");

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  if (zRaw) {
    return Date.UTC(year, month - 1, day, hour, minute, second);
  }

  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

export function parseCalendarInviteFromIcs(
  ics: string,
  selfEmail?: string | null,
): ParsedCalendarInvite | null {
  const unfolded = unfoldIcsLines(ics);
  const lines = unfolded.split(/\r?\n/);
  if (lines.length === 0) return null;

  const selfEmailNormalized = selfEmail?.trim().toLowerCase() ?? null;

  let inEvent = false;
  let method: string | null = null;
  let uid: string | null = null;
  let status: string | null = null;
  let title: string | null = null;
  let location: string | null = null;
  let organizerEmail: string | null = null;
  let startRaw: string | null = null;
  let endRaw: string | null = null;
  let timezone: string | null = null;
  let startMs: number | null = null;
  let endMs: number | null = null;
  let selfResponseStatus: CalendarInviteResponseStatus | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase() === "BEGIN:VEVENT") {
      inEvent = true;
      continue;
    }
    if (line.toUpperCase() === "END:VEVENT") {
      break;
    }

    const parsed = parseProperty(line);
    if (!parsed) continue;

    if (!inEvent) {
      if (parsed.name === "METHOD") {
        method = decodeIcsText(parsed.value).toUpperCase() || null;
      }
      continue;
    }

    switch (parsed.name) {
      case "UID": {
        uid = decodeIcsText(parsed.value) || null;
        break;
      }
      case "SUMMARY": {
        title = decodeIcsText(parsed.value) || null;
        break;
      }
      case "LOCATION": {
        location = decodeIcsText(parsed.value) || null;
        break;
      }
      case "STATUS": {
        status = decodeIcsText(parsed.value).toUpperCase() || null;
        break;
      }
      case "ORGANIZER": {
        organizerEmail = extractMailtoAddress(parsed.value);
        break;
      }
      case "DTSTART": {
        startRaw = parsed.value || null;
        startMs = parseIcsDate(parsed.value);
        timezone = parsed.params.TZID ?? timezone;
        break;
      }
      case "DTEND": {
        endRaw = parsed.value || null;
        endMs = parseIcsDate(parsed.value);
        timezone = parsed.params.TZID ?? timezone;
        break;
      }
      case "ATTENDEE": {
        if (!selfEmailNormalized) break;
        const attendeeEmail = extractMailtoAddress(parsed.value)?.toLowerCase();
        if (!attendeeEmail || attendeeEmail !== selfEmailNormalized) break;
        selfResponseStatus = parsePartStat(parsed.params.PARTSTAT);
        break;
      }
      default:
        break;
    }
  }

  if (!uid) return null;

  return {
    uid,
    method,
    status,
    title,
    location,
    organizerEmail,
    startMs,
    endMs,
    startRaw,
    endRaw,
    timezone,
    selfResponseStatus,
  };
}
