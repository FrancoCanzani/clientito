import { z } from "zod/v4";
import { createReleaseSchema } from "@releaselayer/shared";

export const createReleaseFormSchema = createReleaseSchema.pick({
  title: true,
  slug: true,
  version: true,
  contentMd: true,
  displayType: true,
  showOnce: true,
  publishAt: true,
  unpublishAt: true,
});

export const updateReleaseFormSchema = createReleaseFormSchema;

export function toReleaseSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseDateTimeInput(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const epoch = Math.floor(new Date(value).getTime() / 1000);
  return Number.isFinite(epoch) ? epoch : undefined;
}

export function formatDateTimeInput(epochSeconds: number | null): string {
  if (!epochSeconds) {
    return "";
  }

  const date = new Date(epochSeconds * 1000);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function parseSchedule(
  publishAtInput: string,
  unpublishAtInput: string
): { ok: true; publishAt?: number; unpublishAt?: number } | { ok: false; error: string } {
  const publishAt = parseDateTimeInput(publishAtInput);
  const unpublishAt = parseDateTimeInput(unpublishAtInput);

  const parsed = z
    .object({
      publishAt: z.number().int().optional(),
      unpublishAt: z.number().int().optional(),
    })
    .refine(
      (value) =>
        value.publishAt === undefined ||
        value.unpublishAt === undefined ||
        value.unpublishAt > value.publishAt,
      {
        message: "Unpublish time must be after publish time.",
      }
    )
    .safeParse({ publishAt, unpublishAt });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid release schedule." };
  }

  return {
    ok: true,
    publishAt: parsed.data.publishAt,
    unpublishAt: parsed.data.unpublishAt,
  };
}
