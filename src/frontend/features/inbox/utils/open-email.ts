import { markEmailRead } from "@/features/inbox/mutations";
import { fetchEmailDetailAI } from "@/features/inbox/queries";
import type { EmailListItem, EmailListResponse } from "@/features/inbox/types";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

type FolderView = Exclude<EmailView, "inbox" | "important">;

type NavigateToEmail = (
  options:
    | {
        to: "/$mailboxId/inbox/email/$emailId";
        params: { mailboxId: number; emailId: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/inbox/folders/$folder/email/$emailId";
        params: { mailboxId: number; folder: FolderView; emailId: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/inbox/labels/$label/email/$emailId";
        params: { mailboxId: number; label: "important"; emailId: string };
        replace?: boolean;
      },
) => void;

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

  const context = options?.context ?? "inbox";
  if (context === "important") {
    navigate({
      to: "/$mailboxId/inbox/labels/$label/email/$emailId",
      params: { mailboxId: routeMailboxId, label: "important", emailId: email.id },
      replace: options?.replace,
    });
  } else if (context !== "inbox") {
    navigate({
      to: "/$mailboxId/inbox/folders/$folder/email/$emailId",
      params: { mailboxId: routeMailboxId, folder: context, emailId: email.id },
      replace: options?.replace,
    });
  } else {
    navigate({
      to: "/$mailboxId/inbox/email/$emailId",
      params: { mailboxId: routeMailboxId, emailId: email.id },
      replace: options?.replace,
    });
  }

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
