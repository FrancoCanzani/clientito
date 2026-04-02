export const SEARCH_VIEW_VALUES = [
  "inbox",
  "sent",
  "spam",
  "trash",
  "snoozed",
  "archived",
  "starred",
  "important",
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
};

export function escapeLikePattern(input: string) {
  return input.replace(/[\\%_]/g, "\\$&");
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

    plainTerms.push(stripQuotes(token));
  }

  parsed.plainText = plainTerms.join(" ").trim();
  return parsed;
}
