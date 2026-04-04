import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeAgentText(text: string): string {
  const trimmed = text.trim();

  // Guard against streamed continuation glitches that replay the exact same
  // assistant message body twice inside a single text part.
  if (
    trimmed.length < 160 ||
    (!trimmed.includes("\n") && !trimmed.includes(". "))
  ) {
    return text;
  }

  for (let unitLength = 80; unitLength <= trimmed.length / 2; unitLength += 1) {
    const unit = trimmed.slice(0, unitLength).trim();
    const remainder = trimmed.slice(unitLength).trim();

    if (!remainder) continue;
    if (remainder === unit) {
      return unit;
    }
  }

  return text;
}
