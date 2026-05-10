import { Error as RouteError } from "@/components/error";
import LabelPage from "@/features/email/inbox/pages/label-page";
import { fetchLocalViewPage } from "@/features/email/mail/queries";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { parseInboxLabelParam } from "@/features/email/mail/views";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const labelPageSearchSchema = z.object({
  emailId: z.string().min(1).optional(),
});

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/",
)({
  validateSearch: labelPageSearchSchema,
  params: {
    parse: (raw) => ({ label: parseInboxLabelParam(raw.label) }),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureInfiniteQueryData({
      queryKey: emailQueryKeys.list(params.label, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchLocalViewPage({
          view: params.label,
          mailboxId: params.mailboxId,
          cursor: pageParam || undefined,
        }),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    });
  },
  errorComponent: RouteError,
  component: LabelPage,
});
