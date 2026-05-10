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
