export function normalizeMimeType(input: string | undefined): string {
  if (!input) return "application/octet-stream";
  const normalized = input.trim().toLowerCase();
  return normalized.includes("/") ? normalized : "application/octet-stream";
}

export function normalizeFilename(input: string | undefined): string | null {
  if (!input) return null;
  const normalized = input.replace(/[\r\n]/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}
