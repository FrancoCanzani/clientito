import { markEmailRead } from "@/features/email/inbox/mutations";
import { fetchEmailDetail, fetchEmailDetailAI } from "@/features/email/inbox/queries";
import type { EmailDetailItem, EmailListItem, EmailListResponse } from "@/features/email/inbox/types";
import type {
  EmailFolderView,
  EmailView,
} from "@/features/email/inbox/utils/inbox-filters";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

type NavigateToEmail = (
  options:
    | {
        to: "/$mailboxId/inbox/email/$emailId";
        params: { mailboxId: number; emailId: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/$folder/email/$emailId";
        params: { mailboxId: number; folder: EmailFolderView; emailId: string };
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
    queryKey: ["email-detail", email.id],
    queryFn: () => fetchEmailDetail(email.id),
  });

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
      to: "/$mailboxId/$folder/email/$emailId",
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

  markEmailOpened(queryClient, email);
}

export function markEmailOpened(
  queryClient: QueryClient,
  email: Pick<EmailListItem, "id" | "isRead">,
) {
  if (email.isRead) return;
  queryClient.setQueriesData<InfiniteData<EmailListResponse>>(
    { queryKey: ["emails"] },
    (current) => {
      if (!current) return current;
      let changed = false;
      const pages = current.pages.map((page) => {
        let pageChanged = false;
        const data = page.data.map((entry) => {
          if (entry.id !== email.id || entry.isRead) return entry;
          pageChanged = true;
          changed = true;
          return { ...entry, isRead: true };
        });
        return pageChanged ? { ...page, data } : page;
      });
      return changed ? { ...current, pages } : current;
    },
  );

  queryClient.setQueryData<EmailDetailItem | undefined>(
    ["email-detail", email.id],
    (current) => {
      if (!current || current.isRead) return current;
      return { ...current, isRead: true };
    },
  );

  void markEmailRead(email.id).catch(() => {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-detail", email.id] });
  });
}
