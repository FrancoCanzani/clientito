import DOMPurify from "dompurify";
import { format, isThisYear, isToday } from "date-fns";
import { decode } from "he";

const MAX_SNIPPET_PREVIEW_CHARS = 180;
const MIN_WORD_BREAK_INDEX = 120;
const DEFAULT_IGNORABLE_RE = /[\p{Default_Ignorable_Code_Point}\u034F]/gu;
const ZERO_WIDTH_CHARS_RE = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
const FORMAT_CONTROL_CHARS_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const LEADING_NON_ALNUM_RE = /^[^\p{L}\p{N}]+/u;

export function formatRecipientList(raw: string): string {
 const parts = raw
 .split(",")
 .map((p) => p.trim())
 .filter(Boolean);
 if (parts.length <= 1) return parts[0] ?? raw;
 if (parts.length === 2) return `${parts[0]}, ${parts[1]}`;
 return `${parts[0]} +${parts.length - 1} more`;
}

export function formatInboxRowDate(timestamp: number): string {
 const date = new Date(timestamp);
 if (isToday(date)) {
 return format(date, "p");
 }

 return isThisYear(date) ? format(date, "MMM d") : format(date, "MMM d, yyyy");
}

export function formatEmailDetailDate(timestamp: number): string {
 return new Date(timestamp).toLocaleString([], {
 dateStyle: "medium",
 timeStyle: "short",
 });
}

export function formatEmailThreadDate(timestamp: number): string {
 return new Date(timestamp).toLocaleString([], {
 month: "short",
 day: "numeric",
 hour: "numeric",
 minute: "2-digit",
 });
}

export function formatQuotedDate(timestamp: number): string {
 return new Date(timestamp).toLocaleString([], {
 dateStyle: "medium",
 timeStyle: "short",
 });
}

function trimTrailingEllipsis(value: string): string {
 return value.replace(/(?:\s*(?:\.\.\.|…))+$/g, "").trim();
}

function truncateAtWordBoundary(value: string, maxChars: number): string {
 if (value.length <= maxChars) return value;

 const chunk = value.slice(0, maxChars + 1);
 const lastWhitespace = chunk.lastIndexOf(" ");
 const cutoff =
 lastWhitespace >= MIN_WORD_BREAK_INDEX ? lastWhitespace : maxChars;

 return `${chunk.slice(0, cutoff).trimEnd()}…`;
}

function extractTextFromSanitizedHtml(value: string): string {
 if (!value || typeof DOMParser === "undefined") return value;
 const doc = new DOMParser().parseFromString(value, "text/html");
 return doc.body?.textContent ?? value;
}

function normalizeSnippetText(value: string): string {
 return value
 .replace(DEFAULT_IGNORABLE_RE, "")
 .replace(ZERO_WIDTH_CHARS_RE, "")
 .replace(FORMAT_CONTROL_CHARS_RE, "")
 .replace(/\s+/g, " ")
 .trim()
 .replace(LEADING_NON_ALNUM_RE, "")
 .trimStart();
}

export function formatEmailSnippet(
 raw: string | null | undefined,
): string {
 if (!raw) return "";

 const decoded = decode(raw, { strict: false });
 const sanitizedHtml = DOMPurify.sanitize(decoded, {
 USE_PROFILES: { html: true },
 ALLOWED_ATTR: [],
 });
 const extractedText = extractTextFromSanitizedHtml(sanitizedHtml);
 const cleaned = normalizeSnippetText(extractedText);

 if (!cleaned) return "";

 return truncateAtWordBoundary(
 trimTrailingEllipsis(cleaned),
 MAX_SNIPPET_PREVIEW_CHARS,
 );
}

export function formatBytes(size: number | null): string {
 if (!size || size <= 0) {
 return "Unknown size";
 }

 const units = ["B", "KB", "MB", "GB"];
 let value = size;
 let index = 0;
 while (value >= 1024 && index < units.length - 1) {
 value /= 1024;
 index += 1;
 }

 const decimals = value >= 10 || index === 0 ? 0 : 1;
 return `${value.toFixed(decimals)} ${units[index]}`;
}
