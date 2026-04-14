export function normalizeUnsubscribeUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeUnsubscribeEmail(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = trimmed.startsWith("mailto:")
    ? parseMailtoAddress(trimmed)
    : trimmed;
  if (!candidate) return null;

  const normalized = candidate
    .split("?")[0]
    .split(",")[0]
    .trim()
    .toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function parseMailtoAddress(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "mailto:") return null;
    return decodeURIComponent(parsed.pathname || "").trim() || null;
  } catch {
    return value.replace(/^mailto:/i, "").trim() || null;
  }
}
