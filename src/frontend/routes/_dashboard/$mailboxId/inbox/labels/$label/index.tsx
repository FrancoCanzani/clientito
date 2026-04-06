import InboxLabelPage from "@/features/inbox/pages/inbox-label-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import { labelParamsSchema } from "@/features/inbox/routes/schemas";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/",
)({
  params: {
    parse: (raw) => labelParamsSchema.parse(raw),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ params }) => {
    return {
      initialPage: await fetchEmails({
        view: params.label,
        mailboxId: params.mailboxId,
        limit: EMAIL_LIST_PAGE_SIZE,
        offset: 0,
      }),
    };
  },
  component: InboxLabelPage,
});
