import {
  fetchEmailDetail,
  fetchEmailDetailAI,
} from "@/features/email/inbox/queries";
import type { EmailView } from "@/features/email/inbox/utils/inbox-filters";
import { queryKeys } from "@/lib/query-keys";
import type { QueryClient } from "@tanstack/react-query";

export function createEmailDetailLoader(view: EmailView) {
  return async ({
    context,
    params,
  }: {
    context: { queryClient: QueryClient };
    params: { emailId: string; mailboxId: number };
  }) => {
    const email = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.emails.detail(params.emailId),
      queryFn: () =>
        fetchEmailDetail(params.emailId, {
          mailboxId: params.mailboxId,
          view,
        }),
    });

    void context.queryClient.prefetchQuery({
      queryKey: queryKeys.emails.aiDetail(params.emailId),
      queryFn: () => fetchEmailDetailAI(params.emailId),
    });

    return { email };
  };
}

export const emailDetailRouteOptions = {
  staleTime: 60_000,
  gcTime: 10 * 60_000,
} as const;
