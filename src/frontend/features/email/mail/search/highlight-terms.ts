const OPERATOR_PATTERN = /\b(from|to|cc|subject|has|is|after|before|label):"[^"]*"|\b(from|to|cc|subject|has|is|after|before|label):\S+/g;
const QUOTED_TERM_PATTERN = /"([^"]+)"/g;

export function extractHighlightTerms(query: string): string[] {
  if (!query) return [];

  const terms = new Set<string>();
  const withoutOperators = query.replace(OPERATOR_PATTERN, " ");

  let match: RegExpExecArray | null;
  const quoted = new RegExp(QUOTED_TERM_PATTERN);
  while ((match = quoted.exec(withoutOperators)) !== null) {
    const token = match[1]?.trim();
    if (token) terms.add(token.toLowerCase());
  }

  const unquoted = withoutOperators.replace(QUOTED_TERM_PATTERN, " ");
  for (const token of unquoted.split(/\s+/)) {
    const cleaned = token.trim();
    if (cleaned.length >= 2) terms.add(cleaned.toLowerCase());
  }

  return Array.from(terms);
}

export function buildHighlightRegex(terms: string[]): RegExp | null {
  if (terms.length === 0) return null;
  const escaped = terms
    .map((term) => term.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"))
    .filter(Boolean);
  if (escaped.length === 0) return null;
  return new RegExp(`(${escaped.join("|")})`, "gi");
}
