import EmailInboxPage from "@/features/inbox/pages/email-inbox-page";
import { emailListInfiniteQueryOptions } from "@/features/inbox/queries";
import { queryClient } from "@/lib/query-client";
import { parseMailboxId } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const emailsSearchSchema = z.object({
  compose: z.coerce.boolean().optional(),
  view: z.enum(["important"]).optional(),
});

export const Route = createFileRoute("/_dashboard/inbox/$id/")({
  validateSearch: emailsSearchSchema,
  loaderDeps: ({ search }) => ({
    view: (search.view ?? "inbox") as "important" | "inbox",
  }),
  loader: async ({ deps, params }) => {
    const mailboxId = parseMailboxId(params.id) ?? null;

    await queryClient.ensureInfiniteQueryData(
      emailListInfiniteQueryOptions({ view: deps.view, mailboxId }),
    );

    return { mailboxId };
  },
  component: MailboxInboxRoute,
});

function MailboxInboxRoute() {
  const { mailboxId } = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <EmailInboxPage
      view={search.view ?? "inbox"}
      mailboxId={mailboxId}
    />
  );
}
