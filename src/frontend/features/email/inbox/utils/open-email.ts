import { markEmailRead } from "@/features/email/inbox/mutations";
import { fetchEmailDetail } from "@/features/email/inbox/queries";
import type { EmailDetailItem, EmailListItem, EmailListResponse } from "@/features/email/inbox/types";
import type {
  EmailFolderView,
  InboxLabelView,
} from "@/features/email/inbox/utils/inbox-filters";
import { INBOX_LABEL_VALUES } from "@/features/email/inbox/utils/inbox-filters";
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

const LABEL_VIEW_SET = new Set<string>(INBOX_LABEL_VALUES);

export function openEmail(
  queryClient: QueryClient,
  navigate: NavigateToEmail,
  routeMailboxId: number,
  email: Pick<EmailListItem, "id" | "isRead">,
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
  if (LABEL_VIEW_SET.has(context)) {
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

  markEmailOpened(queryClient, email);
}

export function markEmailOpened(
  queryClient: QueryClient,
  email: Pick<EmailListItem, "id" | "isRead">,
) {
  if (email.isRead) return;
  queryClient.setQueriesData<InfiniteData<EmailListResponse>>(
    { queryKey: queryKeys.emails.all() },
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
    queryKeys.emails.detail(email.id),
    (current) => {
      if (!current || current.isRead) return current;
      return { ...current, isRead: true };
    },
  );

  void markEmailRead(email.id).catch(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.emails.detail(email.id) });
  });
}
