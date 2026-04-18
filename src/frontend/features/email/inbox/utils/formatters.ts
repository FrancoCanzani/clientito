import { format, isThisYear, isToday } from "date-fns";

const MAX_SNIPPET_PREVIEW_CHARS = 180;
const MIN_WORD_BREAK_INDEX = 120;

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

export function formatEmailSnippet(
  raw: string | null | undefined,
): string {
  if (!raw) return "";

  // Use the browser to decode HTML entities and strip tags, then collapse
  // whitespace. We apply a word-boundary trim so the rendered preview ellipsis
  // lands at natural word boundaries rather than mid-word clipping.
  const el = document.createElement("div");
  el.innerHTML = raw;

  const normalized = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  return truncateAtWordBoundary(
    trimTrailingEllipsis(normalized),
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
