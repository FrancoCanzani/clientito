import { markEmailRead } from "@/features/email/mail/mutations";
import { invalidateInboxQueries } from "@/features/email/mail/data/invalidation";
import { fetchEmailDetail } from "@/features/email/mail/data/thread-detail";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type {
  EmailDetailItem,
  EmailListItem,
  EmailListPage,
} from "@/features/email/mail/types";
import { isEmailListInfiniteData } from "@/features/email/mail/utils/email-list-cache";
import type {
  EmailFolderView,
  InboxLabelView,
} from "@/features/email/mail/views";
import { isInboxLabelView } from "@/features/email/mail/views";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

type NavigateToEmail = (
  options:
    | {
        to: "/$mailboxId/inbox/email/$emailId";
        params: { mailboxId: number; emailId: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/inbox";
        params: { mailboxId: number };
        search: { emailId?: string; mode?: "important" | "all" };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/$folder";
        params: { mailboxId: number; folder: EmailFolderView };
        search: { emailId?: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/$folder/email/$emailId";
        params: { mailboxId: number; folder: EmailFolderView; emailId: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/inbox/labels/$label";
        params: { mailboxId: number; label: InboxLabelView };
        search: { emailId?: string };
        replace?: boolean;
      }
    | {
        to: "/$mailboxId/inbox/labels/$label/email/$emailId";
        params: { mailboxId: number; label: InboxLabelView; emailId: string };
        replace?: boolean;
      },
) => void;

type EmailOpenState = Pick<
  EmailListItem,
  "id" | "isRead" | "providerMessageId" | "mailboxId" | "labelIds"
>;

function resolveLatestEmailState(
  queryClient: QueryClient,
  fallback: EmailOpenState,
): EmailOpenState {
  const detail = queryClient.getQueryData<EmailDetailItem | undefined>(
    emailQueryKeys.detail(fallback.id),
  );
  if (detail) {
    return {
      id: detail.id,
      isRead: detail.isRead,
      providerMessageId: detail.providerMessageId,
      mailboxId: detail.mailboxId,
      labelIds: detail.labelIds,
    };
  }

  const snapshots = queryClient.getQueriesData<
    InfiniteData<EmailListPage> | undefined
  >({
    queryKey: emailQueryKeys.all(),
  });

  for (const [, cache] of snapshots) {
    if (!isEmailListInfiniteData(cache)) continue;
    for (const page of cache.pages) {
      const found = page.emails.find((entry) => entry.id === fallback.id);
      if (!found) continue;
      return {
        id: found.id,
        isRead: found.isRead,
        providerMessageId: found.providerMessageId,
        mailboxId: found.mailboxId,
        labelIds: found.labelIds,
      };
    }
  }

  return fallback;
}

export function openEmail(
  queryClient: QueryClient,
  navigate: NavigateToEmail,
  routeMailboxId: number,
  email: Pick<
    EmailListItem,
    "id" | "isRead" | "providerMessageId" | "mailboxId" | "labelIds"
  >,
  options?: {
    replace?: boolean;
    context?: string;
    inboxMode?: "important" | "all";
    presentation?: "route" | "panel";
  },
) {
  const emailState = resolveLatestEmailState(queryClient, email);
  const mutationMailboxId = emailState.mailboxId ?? routeMailboxId;

  void queryClient.prefetchQuery({
    queryKey: emailQueryKeys.detail(emailState.id),
    queryFn: () =>
      fetchEmailDetail(emailState.id, {
        mailboxId: routeMailboxId,
        view: options?.context,
      }),
    staleTime: 60_000,
    gcTime: 2 * 60_000,
  });

  const context = options?.context ?? "inbox";
  if (context === "inbox" && options?.presentation === "panel") {
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId: routeMailboxId },
      search: {
        emailId: emailState.id,
        ...(options?.inboxMode === "all" ? { mode: "all" } : {}),
      },
      replace: options?.replace,
    });
  } else if (isInboxLabelView(context)) {
    if (options?.presentation === "panel") {
      navigate({
        to: "/$mailboxId/inbox/labels/$label",
        params: {
          mailboxId: routeMailboxId,
          label: context,
        },
        search: { emailId: emailState.id },
        replace: options?.replace,
      });
    } else {
      navigate({
        to: "/$mailboxId/inbox/labels/$label/email/$emailId",
        params: {
          mailboxId: routeMailboxId,
          label: context,
          emailId: emailState.id,
        },
        replace: options?.replace,
      });
    }
  } else if (context !== "inbox") {
    if (options?.presentation === "panel") {
      navigate({
        to: "/$mailboxId/$folder",
        params: {
          mailboxId: routeMailboxId,
          folder: context,
        },
        search: { emailId: emailState.id },
        replace: options?.replace,
      });
    } else {
      navigate({
        to: "/$mailboxId/$folder/email/$emailId",
        params: {
          mailboxId: routeMailboxId,
          folder: context,
          emailId: emailState.id,
        },
        replace: options?.replace,
      });
    }
  } else {
    navigate({
      to: "/$mailboxId/inbox/email/$emailId",
      params: { mailboxId: routeMailboxId, emailId: emailState.id },
      replace: options?.replace,
    });
  }

  markEmailOpened(queryClient, emailState, mutationMailboxId);
}

function markEmailOpened(
  queryClient: QueryClient,
  email: Pick<
    EmailListItem,
    "id" | "isRead" | "providerMessageId" | "mailboxId" | "labelIds"
  >,
  mailboxId: number,
) {
  if (email.isRead) return;
  queryClient.setQueriesData({ queryKey: emailQueryKeys.all() }, (current) => {
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
  });

  queryClient.setQueryData<EmailDetailItem | undefined>(
    emailQueryKeys.detail(email.id),
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
    // Roll back the optimistic update if the server call fails.
    invalidateInboxQueries();
    queryClient.invalidateQueries({
      queryKey: emailQueryKeys.detail(email.id),
    });
  });
}
