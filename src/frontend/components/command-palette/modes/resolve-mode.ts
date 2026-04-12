import type { InputMode } from "./types";

export function resolveMode(input: string): {
  mode: InputMode;
  query: string;
} {
  if (input.startsWith(">")) {
    return { mode: "commands", query: input.slice(1).trimStart() };
  }
  if (input.startsWith("@")) {
    return { mode: "people", query: input.slice(1).trimStart() };
  }
  if (input.startsWith("#")) {
    return { mode: "search", query: input.slice(1).trimStart() };
  }
  return { mode: "default", query: input };
}

export const MODE_LABELS: Record<InputMode, string> = {
  default: "Search",
  commands: "Commands",
  people: "People",
  search: "Emails",
};

export const MODE_PLACEHOLDERS: Record<InputMode, string> = {
  default: "Search or run a command...",
  commands: "Search commands...",
  people: "Search people...",
  search: "Search emails...",
};
