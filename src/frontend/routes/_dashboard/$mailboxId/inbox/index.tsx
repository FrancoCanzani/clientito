import InboxPage from "@/features/inbox/pages/inbox-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const emailsSearchSchema = z.object({
  compose: z.coerce.boolean().optional(),
  view: z.enum(["important"]).optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  validateSearch: emailsSearchSchema,
  loaderDeps: ({ search }) => ({
    view: (search.view ?? "inbox") as "important" | "inbox",
  }),
  loader: async ({ deps, params }) => {
    const initialPage = await fetchEmails({
      view: deps.view,
      mailboxId: params.mailboxId,
      limit: EMAIL_LIST_PAGE_SIZE,
      offset: 0,
    });
    return { view: deps.view as EmailView, initialPage };
  },
  component: InboxPage,
});
