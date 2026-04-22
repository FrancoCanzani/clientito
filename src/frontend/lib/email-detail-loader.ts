import {
  fetchEmailDetail,
} from "@/features/email/inbox/queries";
import { queryKeys } from "@/lib/query-keys";
import type { QueryClient } from "@tanstack/react-query";

export function createEmailDetailLoader(view: string) {
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
      staleTime: 60_000,
    });
    return { email };
  };
}

export const emailDetailRouteOptions = {
  staleTime: 60_000,
  gcTime: 2 * 60_000,
} as const;
