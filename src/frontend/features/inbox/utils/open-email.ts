import { markEmailRead } from "@/features/inbox/mutations";
import type { EmailListItem, EmailListResponse } from "@/features/inbox/types";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

type NavigateToEmail = (options: {
  to: "/inbox/$id/email/$emailId";
  params: { id: string; emailId: string };
  replace?: boolean;
}) => void;

export function openEmail(
  queryClient: QueryClient,
  navigate: NavigateToEmail,
  routeMailboxId: string,
  email: Pick<EmailListItem, "id" | "isRead">,
  options?: { replace?: boolean },
) {
  navigate({
    to: "/inbox/$id/email/$emailId",
    params: { id: routeMailboxId, emailId: email.id },
    replace: options?.replace,
  });

  if (email.isRead) return;

  queryClient.setQueriesData(
    { queryKey: ["emails"] },
    (old: InfiniteData<EmailListResponse> | undefined) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.map((current) =>
            current.id === email.id ? { ...current, isRead: true } : current,
          ),
        })),
      };
    },
  );

  queryClient.setQueryData(
    ["email-detail", email.id],
    (old: EmailListItem | undefined) =>
      old ? { ...old, isRead: true } : old,
  );

  markEmailRead(email.id).catch(() => {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-detail", email.id] });
  });
}
