import LabelEmailPage from "@/features/email/inbox/pages/label-email-page";
import { fetchEmailDetail, fetchEmailDetailAI } from "@/features/email/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";
import { labelEmailParamsSchema } from "@/features/email/inbox/routes/schemas";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/email/$emailId",
)({
  params: {
    parse: (raw) => labelEmailParamsSchema.parse(raw),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ context, params }) => {
    const email = await context.queryClient.ensureQueryData({
      queryKey: ["email-detail", params.emailId],
      queryFn: () => fetchEmailDetail(params.emailId),
    });

    void context.queryClient.prefetchQuery({
      queryKey: ["email-ai-detail", params.emailId],
      queryFn: () => fetchEmailDetailAI(params.emailId),
    });

    return { email };
  },
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  component: LabelEmailPage,
});
