import { Error as RouteError } from "@/components/error";
import InboxPage from "@/features/email/inbox/pages/inbox-page";
import { fetchLocalViewPage } from "@/features/email/mail/queries";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { enqueueMailboxRouteViewSync } from "@/features/email/shell/route-sync";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const inboxPageSearchSchema = z.object({
  emailId: z.string().min(1).optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  validateSearch: inboxPageSearchSchema,
  beforeLoad: ({ params, preload }) => {
    enqueueMailboxRouteViewSync({
      view: "inbox",
      mailboxId: params.mailboxId,
      preload,
    });
  },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureInfiniteQueryData({
      queryKey: emailQueryKeys.list("inbox", params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchLocalViewPage({
          view: "inbox",
          mailboxId: params.mailboxId,
          cursor: pageParam || undefined,
        }),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    });
  },
  errorComponent: RouteError,
  component: InboxPage,
});
