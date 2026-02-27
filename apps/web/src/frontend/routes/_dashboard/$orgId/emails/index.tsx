import { fetchEmails } from "@/features/emails/api";
import EmailInboxPage from "@/features/emails/pages/email-inbox-page";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const TAB_VALUES = [
  "all",
  "primary",
  "promotions",
  "social",
  "notifications",
] as const;

const emailsSearchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional().catch(undefined),
});

export const Route = createFileRoute("/_dashboard/$orgId/emails/")({
  validateSearch: emailsSearchSchema,
  loaderDeps: ({ search }) => ({ tab: search.tab ?? "primary" }),
  loader: async ({ params, deps }) => {
    const category = deps.tab === "all" ? undefined : deps.tab;

    const initialEmails = await fetchEmails(params.orgId, {
      limit: 100,
      offset: 0,
      category,
    });

    return { initialEmails };
  },
  component: EmailInboxPage,
});
