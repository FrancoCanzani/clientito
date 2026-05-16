function extractTerms(query: string): string[] {
 const cleaned = query
 .replace(/\b(?:from|to|cc|subject|is|has):\S+/gi, " ")
 .replace(/["']/g, " ")
 .trim();
 if (!cleaned) return [];
 return cleaned
 .split(/\s+/)
 .filter((term) => term.length >= 2)
 .slice(0, 5);
}

const FORWARDED_BOILERPLATE_RE =
 /(?:-{2,}\s*)?forwarded message(?:\s*-{2,})?/gi;
const REPEATED_HEADER_RE =
 /\b(?:from|to|cc|subject|date):\s*[^]*?(?=\b(?:from|to|cc|subject|date):|$)/gi;
const LONG_SEPARATOR_RE = /[-_=]{5,}/g;

function cleanSearchText(value: string): string {
 return value
 .replace(FORWARDED_BOILERPLATE_RE, " ")
 .replace(REPEATED_HEADER_RE, " ")
 .replace(LONG_SEPARATOR_RE, " ")
 .replace(/\s+/g, " ")
 .trim();
}

function expandToWordBoundary(
 text: string,
 index: number,
 direction: "start" | "end",
): number {
 if (index <= 0 || index >= text.length) return index;

 if (direction === "start") {
   const previousSpace = text.lastIndexOf(" ", index);
   return previousSpace === -1 ? 0 : previousSpace + 1;
 }

 const nextSpace = text.indexOf(" ", index);
 return nextSpace === -1 ? text.length : nextSpace;
}

export function buildSearchSnippet(
 bodyText: string | null | undefined,
 query: string,
 fallback: string | null,
 windowSize = 80,
): string | null {
 const text = bodyText ? cleanSearchText(bodyText) : "";
 if (!text) return fallback;

 const terms = extractTerms(query);
 if (terms.length === 0) return fallback;

 const lowerText = text.toLowerCase();
 let earliest = -1;
 let matchedTerm = "";
 for (const term of terms) {
 const index = lowerText.indexOf(term.toLowerCase());
 if (index !== -1 && (earliest === -1 || index < earliest)) {
 earliest = index;
 matchedTerm = term;
 }
 }

 if (earliest === -1) return fallback;

 const roughStart = Math.max(0, earliest - windowSize);
 const roughEnd = Math.min(
 text.length,
 earliest + matchedTerm.length + windowSize,
 );
 const start = expandToWordBoundary(text, roughStart, "start");
 const end = expandToWordBoundary(text, roughEnd, "end");
 const prefix = start > 0 ? "…" : "";
 const suffix = end < text.length ? "…" : "";
 return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}
