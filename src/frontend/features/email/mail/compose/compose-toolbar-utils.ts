export function normalizeLink(raw: string): string {
 const trimmed = raw.trim();
 if (!trimmed) return "";
 if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;
 return `https://${trimmed}`;
}
