export function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function uniqueId(): string {
  return crypto.randomUUID();
}

export function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}
