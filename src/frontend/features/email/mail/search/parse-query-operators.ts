export type SearchOperator = {
 key: string;
 value: string;
 raw: string;
};

const OPERATOR_PATTERN =
 /\b(from|to|cc|subject|has|is|after|before|label):"[^"]*"|\b(from|to|cc|subject|has|is|after|before|label):\S+/g;

export function parseSearchOperators(query: string): SearchOperator[] {
 if (!query) return [];
 const matches = query.match(OPERATOR_PATTERN);
 if (!matches) return [];
 return matches.map((raw) => {
 const colonIndex = raw.indexOf(":");
 const key = raw.slice(0, colonIndex).toLowerCase();
 const valueRaw = raw.slice(colonIndex + 1);
 const value = valueRaw.startsWith('"') && valueRaw.endsWith('"')
 ? valueRaw.slice(1, -1)
 : valueRaw;
 return { key, value, raw };
 });
}

export function removeOperator(query: string, raw: string): string {
 return query
 .replace(raw, "")
 .replace(/\s+/g, " ")
 .trim();
}

function quoteOperatorValue(value: string): string {
 return /\s/.test(value) ? `"${value}"` : value;
}

export function replaceOperator(
 query: string,
 key: string,
 value: string | null,
): string {
 const remaining = parseSearchOperators(query)
 .filter((operator) => operator.key !== key)
 .reduce((nextQuery, operator) => removeOperator(nextQuery, operator.raw), query);

 const nextOperator = value?.trim()
 ? `${key}:${quoteOperatorValue(value.trim())}`
 : "";

 return [remaining.trim(), nextOperator].filter(Boolean).join(" ").trim();
}
