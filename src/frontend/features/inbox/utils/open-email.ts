import { markEmailRead } from "@/features/inbox/mutations";
import { fetchEmailDetailAI } from "@/features/inbox/queries";
import type { EmailListItem, EmailListResponse } from "@/features/inbox/types";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

type NavigateToEmail = (options: {
  to: "/$mailboxId/inbox/email/$emailId";
  params: { mailboxId: number; emailId: string };
  search?: { context?: EmailView };
  replace?: boolean;
}) => void;

export function openEmail(
  queryClient: QueryClient,
  navigate: NavigateToEmail,
  routeMailboxId: number,
  email: Pick<EmailListItem, "id" | "isRead">,
  options?: { replace?: boolean; context?: EmailView },
) {
  void queryClient.prefetchQuery({
    queryKey: ["email-ai-detail", email.id],
    queryFn: () => fetchEmailDetailAI(email.id),
  });

  navigate({
    to: "/$mailboxId/inbox/email/$emailId",
    params: { mailboxId: routeMailboxId, emailId: email.id },
    search: {
      context:
        options?.context && options.context !== "inbox"
          ? options.context
          : undefined,
    },
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
    (old: EmailListItem | undefined) => (old ? { ...old, isRead: true } : old),
  );

  markEmailRead(email.id).catch(() => {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-detail", email.id] });
  });
}
