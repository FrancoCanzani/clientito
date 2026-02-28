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
type InboxFilterTab = (typeof TAB_VALUES)[number];

function getCategoryFromTab(tab: InboxFilterTab) {
  switch (tab) {
    case "all":
      return undefined;
    case "primary":
    case "promotions":
    case "social":
    case "notifications":
      return tab;
  }
}

const emailsSearchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional(),
  q: z.string().trim().optional(),
  emailId: z.string().trim().optional(),
});

export const Route = createFileRoute("/_dashboard/$orgId/emails/")({
  validateSearch: emailsSearchSchema,
  loaderDeps: ({ search }) => ({
    tab: search.tab ?? "primary",
    q: search.q ?? "",
  }),
  loader: async ({ params, deps }) => {
    const category = getCategoryFromTab(deps.tab);

    const initialEmails = await fetchEmails(params.orgId, {
      limit: 50,
      offset: 0,
      search: deps.q || undefined,
      category,
    });

    return { initialEmails };
  },
  component: EmailInboxPage,
});
