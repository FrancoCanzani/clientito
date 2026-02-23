import { z } from "zod/v4";
import { checklistItemSchema, createChecklistSchema } from "@releaselayer/shared";

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const createChecklistFormSchema = createChecklistSchema;
export const createChecklistItemFormSchema = checklistItemSchema.pick({
  title: true,
  trackEvent: true,
  description: true,
  sortOrder: true,
});

export function parseOptionalJsonRecord(
  value: string
): { ok: true; data: Record<string, unknown> | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, data: null };
  }

  const parsedJson = parseJson(trimmed);
  const parsed = jsonRecordSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, error: "Target traits JSON must be a valid JSON object." };
  }

  return { ok: true, data: parsed.data };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
