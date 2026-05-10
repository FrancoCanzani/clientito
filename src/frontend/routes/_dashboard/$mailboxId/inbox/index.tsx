import { Error as RouteError } from "@/components/error";
import InboxPage from "@/features/email/inbox/pages/inbox-page";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

function normalizeEmailIdSearch(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

const inboxPageSearchSchema = z.object({
  emailId: z.preprocess(normalizeEmailIdSearch, z.string().min(1)).optional(),
  mode: z.enum(["important", "all"]).optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  validateSearch: inboxPageSearchSchema,
  errorComponent: RouteError,
  component: InboxPage,
});
