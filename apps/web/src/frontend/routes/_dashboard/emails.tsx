import EmailInboxPage from "@/features/emails/pages/email-inbox-page";
import { fetchEmails } from "@/features/emails/queries/fetch-emails";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const emailsSearchSchema = z.object({
  id: z.string().trim().optional(),
  emailId: z.string().trim().optional(),
  threadId: z.string().trim().optional(),
  compose: z.coerce.boolean().optional(),
  view: z.enum(["inbox", "sent", "spam", "trash", "all"]).optional(),
  category: z
    .enum(["all", "primary", "promotions", "social", "notifications"])
    .optional(),
});

export const Route = createFileRoute("/_dashboard/emails")({
  validateSearch: emailsSearchSchema,
  loaderDeps: ({ search }) => ({
    view: search.view ?? "inbox",
    category: search.category ?? "all",
  }),
  loader: async ({ deps }) => {
    const category =
      deps.view === "inbox" &&
      (deps.category === "primary" ||
        deps.category === "promotions" ||
        deps.category === "social" ||
        deps.category === "notifications")
        ? deps.category
        : "all";
    const initialEmails = await fetchEmails({
      view: deps.view,
      category: category === "all" ? undefined : category,
      limit: 100,
      offset: 0,
    });
    return { initialEmails };
  },
  component: EmailInboxPage,
});
