import { markEmailRead } from "@/features/email/inbox/mutations";
import { fetchEmailDetail } from "@/features/email/inbox/queries";
import type { EmailDetailItem, EmailListItem, EmailListPage } from "@/features/email/inbox/types";
import type {
  EmailFolderView,
  InboxLabelView,
} from "@/features/email/inbox/utils/inbox-filters";
import { isEmailListInfiniteData } from "@/features/email/inbox/utils/email-list-cache";
import { isInboxLabelView } from "@/features/email/inbox/utils/inbox-filters";
import { invalidateInboxQueries } from "@/features/email/inbox/queries";
import { queryKeys } from "@/lib/query-keys";
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
        params: { mailboxId: number; label: InboxLabelView; emailId: string };
        replace?: boolean;
      },
) => void;


export function openEmail(
  queryClient: QueryClient,
  navigate: NavigateToEmail,
  routeMailboxId: number,
  email: Pick<EmailListItem, "id" | "isRead" | "providerMessageId" | "mailboxId" | "labelIds">,
  options?: { replace?: boolean; context?: string },
) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.emails.detail(email.id),
    queryFn: () =>
      fetchEmailDetail(email.id, {
        mailboxId: routeMailboxId,
        view: options?.context,
      }),
  });

  const context = options?.context ?? "inbox";
  if (isInboxLabelView(context)) {
    navigate({
      to: "/$mailboxId/inbox/labels/$label/email/$emailId",
      params: { mailboxId: routeMailboxId, label: context as InboxLabelView, emailId: email.id },
      replace: options?.replace,
    });
  } else if (context !== "inbox") {
    navigate({
      to: "/$mailboxId/$folder/email/$emailId",
      params: { mailboxId: routeMailboxId, folder: context as EmailFolderView, emailId: email.id },
      replace: options?.replace,
    });
  } else {
    navigate({
      to: "/$mailboxId/inbox/email/$emailId",
      params: { mailboxId: routeMailboxId, emailId: email.id },
      replace: options?.replace,
    });
  }

  markEmailOpened(queryClient, email, routeMailboxId);
}

export function markEmailOpened(
  queryClient: QueryClient,
  email: Pick<EmailListItem, "id" | "isRead" | "providerMessageId" | "mailboxId" | "labelIds">,
  mailboxId: number,
) {
  if (email.isRead) return;
  queryClient.setQueriesData(
    { queryKey: queryKeys.emails.all() },
    (current) => {
      if (!isEmailListInfiniteData(current)) return current;
      let changed = false;
      const pages = current.pages.map((page) => {
        let pageChanged = false;
        const emails = page.emails.map((entry) => {
          if (entry.id !== email.id || entry.isRead) return entry;
          pageChanged = true;
          changed = true;
          return { ...entry, isRead: true };
        });
        return pageChanged ? { ...page, emails } : page;
      });
      const next: InfiniteData<EmailListPage> = { ...current, pages };
      return changed ? next : current;
    },
  );

  queryClient.setQueryData<EmailDetailItem | undefined>(
    queryKeys.emails.detail(email.id),
    (current) => {
      if (!current || current.isRead) return current;
      return { ...current, isRead: true };
    },
  );

  void markEmailRead({
    id: email.id,
    providerMessageId: email.providerMessageId,
    mailboxId,
    labelIds: email.labelIds,
  }).catch(() => {
    invalidateInboxQueries();
    queryClient.invalidateQueries({ queryKey: queryKeys.emails.detail(email.id) });
  });
}
