export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractEmailAddress(
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

export function extractEmailAddressList(
  value: string | null | undefined,
): string[] {
  if (!value) return [];
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let buf = "";
  for (const ch of value) {
    if (ch === '"') inQuote = !inQuote;
    else if (!inQuote && (ch === "<" || ch === "(")) depth++;
    else if (!inQuote && (ch === ">" || ch === ")")) depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0 && !inQuote) {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const addr = extractEmailAddress(part);
    if (addr && !seen.has(addr)) {
      seen.add(addr);
      out.push(addr);
    }
  }
  return out;
}
