import EmailDetailPage from "@/features/inbox/pages/email-detail-page";
import { fetchEmailDetail } from "@/features/inbox/queries";
import { queryClient } from "@/lib/query-client";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const emailDetailSearchSchema = z.object({
  context: z
    .enum([
      "inbox",
      "sent",
      "spam",
      "trash",
      "archived",
      "starred",
      "important",
    ])
    .optional(),
});

export const Route = createFileRoute("/_dashboard/inbox/$id/email/$emailId")({
  validateSearch: emailDetailSearchSchema,
  loader: async ({ params }) => {
    const email = await queryClient.ensureQueryData(
      {
        queryKey: ["email-detail", params.emailId],
        queryFn: () => fetchEmailDetail(params.emailId),
        staleTime: 60_000,
      },
    );

    return { email };
  },
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  component: EmailDetailPage,
});
