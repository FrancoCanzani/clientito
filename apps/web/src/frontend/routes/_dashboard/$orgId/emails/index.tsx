import { fetchEmails } from "@/features/emails/queries/fetch-emails";
import {
  TAB_VALUES,
  VIEW_VALUES,
  getCategoryFromTab,
} from "@/features/emails/utils/inbox-filters";
import EmailInboxPage from "@/features/emails/pages/email-inbox-page";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const emailsSearchSchema = z.object({
  tab: z.enum(TAB_VALUES).optional(),
  view: z.enum(VIEW_VALUES).optional(),
  q: z.string().trim().optional(),
  emailId: z.string().trim().optional(),
});

export const Route = createFileRoute("/_dashboard/$orgId/emails/")({
  validateSearch: emailsSearchSchema,
  loaderDeps: ({ search }) => ({
    tab: search.tab ?? "primary",
    view: search.view ?? "inbox",
    q: search.q ?? "",
  }),
  loader: async ({ params, deps }) => {
    const category = deps.view === "inbox" ? getCategoryFromTab(deps.tab) : undefined;

    const initialEmails = await fetchEmails(params.orgId, {
      limit: 50,
      offset: 0,
      search: deps.q || undefined,
      category,
      view: deps.view,
    });

    return { initialEmails };
  },
  component: EmailInboxPage,
});
