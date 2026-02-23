import { z } from "zod/v4";
import { createIntegrationSchema } from "@releaselayer/shared";

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const createIntegrationFormSchema = createIntegrationSchema;

export function parseJsonRecord(
  value: string,
  options?: { emptyMessage?: string }
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: options?.emptyMessage ?? "Config JSON is required." };
  }

  const parsedJson = parseJson(trimmed);
  const parsed = jsonRecordSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, error: "Config must be a valid JSON object." };
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
