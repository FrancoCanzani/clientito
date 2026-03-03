import * as chrono from "chrono-node";

export function parseTaskInput(input: string): {
  title: string;
  dueAt?: number;
} {
  const raw = input.trim();
  if (!raw) {
    return { title: "" };
  }

  const matches = chrono.parse(raw, new Date(), { forwardDate: true });
  const first = matches[0];

  if (!first) {
    return { title: raw };
  }

  const dueAt = first.start.date().getTime();
  const before = raw.slice(0, first.index).trim();
  const after = raw.slice(first.index + first.text.length).trim();
  const title = `${before} ${after}`.trim() || raw;

  return { title, dueAt };
}
