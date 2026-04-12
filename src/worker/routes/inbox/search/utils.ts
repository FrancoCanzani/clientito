export const SEARCH_VIEW_VALUES = [
  "inbox",
  "sent",
  "spam",
  "trash",
  "snoozed",
  "archived",
  "starred",
  "important",
  "to_respond",
  "to_follow_up",
  "fyi",
  "notification",
  "invoice",
  "marketing",
] as const;

export type SearchView = (typeof SEARCH_VIEW_VALUES)[number];

export type ParsedSearchQuery = {
  plainText: string;
  from: string[];
  to: string[];
  subject: string[];
  isRead?: boolean;
  hasAttachment?: boolean;
  view?: SearchView;
  before?: number;
  after?: number;
};

export function escapeLikePattern(input: string) {
  return input.replace(/[\\%_]/g, "\\$&");
}

const RELATIVE_DATE_RE = /^(\d+)([dwmy])$/;

/**
 * Parses a date value into a Unix timestamp (ms).
 * Accepts ISO dates (2024-01-15) or relative shorthand (7d, 2w, 3m, 1y).
 */
function parseDateValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const relMatch = trimmed.match(RELATIVE_DATE_RE);
  if (relMatch) {
    const amount = Number(relMatch[1]);
    const unit = relMatch[2];
    const now = new Date();
    switch (unit) {
      case "d":
        now.setDate(now.getDate() - amount);
        break;
      case "w":
        now.setDate(now.getDate() - amount * 7);
        break;
      case "m":
        now.setMonth(now.getMonth() - amount);
        break;
      case "y":
        now.setFullYear(now.getFullYear() - amount);
        break;
    }
    return now.getTime();
  }

  const ts = new Date(trimmed).getTime();
  return Number.isNaN(ts) ? null : ts;
}

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const tokens = input.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const plainTerms: string[] = [];
  const parsed: ParsedSearchQuery = {
    plainText: "",
    from: [],
    to: [],
    subject: [],
  };

  const stripQuotes = (value: string) => value.replace(/^"|"$/g, "").trim();

  for (const token of tokens) {
    const lowerToken = token.toLowerCase();

    if (lowerToken.startsWith("from:")) {
      const value = stripQuotes(token.slice(5));
      if (value) parsed.from.push(value);
      continue;
    }

    if (lowerToken.startsWith("to:")) {
      const value = stripQuotes(token.slice(3));
      if (value) parsed.to.push(value);
      continue;
    }

    if (lowerToken.startsWith("subject:")) {
      const value = stripQuotes(token.slice(8));
      if (value) parsed.subject.push(value);
      continue;
    }

    if (lowerToken === "is:unread") {
      parsed.isRead = false;
      continue;
    }

    if (lowerToken === "is:read") {
      parsed.isRead = true;
      continue;
    }

    if (lowerToken === "has:attachment") {
      parsed.hasAttachment = true;
      continue;
    }

    if (lowerToken.startsWith("in:")) {
      const view = lowerToken.slice(3) as SearchView;
      if (SEARCH_VIEW_VALUES.includes(view)) {
        parsed.view = view;
        continue;
      }
    }

    if (lowerToken.startsWith("before:")) {
      const ts = parseDateValue(token.slice(7));
      if (ts !== null) parsed.before = ts;
      continue;
    }

    if (lowerToken.startsWith("after:")) {
      const ts = parseDateValue(token.slice(6));
      if (ts !== null) parsed.after = ts;
      continue;
    }

    plainTerms.push(stripQuotes(token));
  }

  parsed.plainText = plainTerms.join(" ").trim();
  return parsed;
}
