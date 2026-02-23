import { z } from "zod/v4";
import { sdkConfigSchema } from "@releaselayer/shared";

export const sdkPositionSchema = z.enum([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
  "center",
]);

export const updateSdkConfigFormSchema = sdkConfigSchema.extend({
  position: sdkPositionSchema,
  zIndex: z.number().int(),
  customCss: z.string().nullable(),
  theme: z.record(z.string(), z.unknown()),
});

export function normalizeZIndex(value: FormDataEntryValue | null): number {
  const parsed = Number(value ?? 99999);
  return Number.isFinite(parsed) ? parsed : 99999;
}
