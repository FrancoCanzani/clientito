import { PageSpinner } from "@/components/page-spinner";
import { Button } from "@/components/ui/button";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import {
  fetchEmailDetail,
  fetchEmailThread,
} from "@/features/email/mail/data/thread-detail";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import {
  EmailDetailContent,
  type EmailDetailContentHandle,
} from "@/features/email/mail/thread/email-detail-content";
import type {
  ComposeInitial,
  EmailDetailItem,
  EmailListPage,
} from "@/features/email/mail/types";
import { buildForwardedEmailHtml } from "@/features/email/mail/utils/build-forwarded-html";
import { isEmailListInfiniteData } from "@/features/email/mail/utils/email-list-cache";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { openEmail as openInboxEmail } from "@/features/email/mail/utils/open-email";
import { MailboxPage } from "@/features/email/shell/mailbox-page";
import { clearFocusedEmail, setFocusedEmail } from "@/hooks/use-focused-email";
import { useShortcuts } from "@/hooks/use-shortcuts";
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function EmailDetailView({
  mailboxId,
  emailId,
  view,
  inboxMode,
  onNavigateToEmail,
  onClose,
  listGroups,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
  embedded = false,
}: {
  mailboxId: number;
  emailId: string;
  view: string;
  inboxMode?: "important" | "all";
  onNavigateToEmail: (nextEmailId: string) => void;
  onClose?: () => void;
  listGroups?: ThreadGroup[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => Promise<unknown>;
  embedded?: boolean;
}) {
  const emailQuery = useQuery({
    queryKey: emailQueryKeys.detail(emailId),
    queryFn: () =>
      fetchEmailDetail(emailId, {
        mailboxId,
        view,
      }),
    staleTime: 60_000,
    gcTime: 2 * 60_000,
  });

  if (emailQuery.isError) {
    const message =
      emailQuery.error instanceof Error
        ? emailQuery.error.message
        : "Unable to load email";

    return (
      <div className="flex flex-1 min-h-[50vh] flex-col items-center justify-center px-6">
        <div className="space-y-3 text-center">
          <p className="text-sm font-medium text-foreground">
            Unable to open email
          </p>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void emailQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!emailQuery.data) {
    return <PageSpinner />;
  }

  return (
    <EmailDetailPane
      email={emailQuery.data}
      mailboxId={mailboxId}
      emailId={emailId}
      view={view}
      inboxMode={inboxMode}
      onNavigateToEmail={onNavigateToEmail}
      onClose={onClose}
      listGroups={listGroups}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      embedded={embedded}
    />
  );
}

function EmailDetailPane({
  email,
  mailboxId,
  emailId,
  view,
  inboxMode,
  onNavigateToEmail,
  onClose,
  listGroups,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  embedded,
}: {
  email: EmailDetailItem;
  mailboxId: number;
  emailId: string;
  view: string;
  inboxMode?: "important" | "all";
  onNavigateToEmail: (nextEmailId: string) => void;
  onClose?: () => void;
  listGroups?: ThreadGroup[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage?: () => Promise<unknown>;
  embedded: boolean;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openCompose } = useMailCompose();
  const { executeEmailAction } = useMailActions({
    view,
    mailboxId,
    presentation: embedded ? "panel" : "route",
  });
  const contentRef = useRef<EmailDetailContentHandle>(null);
  const pendingNextAfterFetchRef = useRef(false);
  const [isLoadingNextEmail, setIsLoadingNextEmail] = useState(false);
  const currentEmail = email;

  useEffect(() => {
    setFocusedEmail({
      id: currentEmail.id,
      fromAddr: currentEmail.fromAddr,
      fromName: currentEmail.fromName,
      subject: currentEmail.subject,
      threadId: currentEmail.threadId,
      mailboxId: currentEmail.mailboxId,
    });
    return () => clearFocusedEmail();
  }, [
    currentEmail.id,
    currentEmail.fromAddr,
    currentEmail.fromName,
    currentEmail.subject,
    currentEmail.threadId,
    currentEmail.mailboxId,
  ]);

  const orderedEmails = useMemo(() => {
    if (listGroups) {
      return listGroups.map((group) => group.representative);
    }
    const data = queryClient.getQueryData<InfiniteData<EmailListPage>>(
      emailQueryKeys.list(view, mailboxId),
    );
    if (!isEmailListInfiniteData(data)) return [];
    return data.pages.flatMap((page) => page.emails);
  }, [listGroups, queryClient, mailboxId, view]);

  const orderedIds = useMemo(
    () => orderedEmails.map((item) => item.id),
    [orderedEmails],
  );
  const orderedEmailById = useMemo(
    () => new Map(orderedEmails.map((item) => [item.id, item])),
    [orderedEmails],
  );

  const currentIndex = useMemo(() => {
    if (listGroups) {
      const groupIndex = listGroups.findIndex(
        (group) =>
          group.representative.id === emailId ||
          group.emails.some((item) => item.id === emailId),
      );
      if (groupIndex !== -1) return groupIndex;
    }

    return orderedIds.indexOf(emailId);
  }, [emailId, listGroups, orderedIds]);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < orderedIds.length - 1;
  const canLoadNext =
    currentIndex >= 0 && !hasNext && hasNextPage && Boolean(fetchNextPage);
  const canNavigateNext = hasNext || canLoadNext || isLoadingNextEmail;

  const navigateToEmailId = useCallback(
    (nextId: string) => {
      if (!nextId) return;

      const nextEmail = orderedEmailById.get(nextId);
      if (nextEmail) {
        openInboxEmail(
          queryClient,
          navigate,
          nextEmail.mailboxId ?? mailboxId,
          nextEmail,
          {
            context: view,
            inboxMode,
            presentation: embedded ? "panel" : "route",
            replace: true,
          },
        );
        return;
      }

      onNavigateToEmail(nextId);
    },
    [
      orderedEmailById,
      queryClient,
      navigate,
      mailboxId,
      view,
      inboxMode,
      onNavigateToEmail,
      embedded,
    ],
  );

  useEffect(() => {
    if (!pendingNextAfterFetchRef.current) return;
    if (isFetchingNextPage) return;

    const nextId = orderedIds[currentIndex + 1];
    if (nextId) {
      pendingNextAfterFetchRef.current = false;
      setIsLoadingNextEmail(false);
      navigateToEmailId(nextId);
      return;
    }

    if (!hasNextPage) {
      pendingNextAfterFetchRef.current = false;
      setIsLoadingNextEmail(false);
    }
  }, [
    currentIndex,
    hasNextPage,
    isFetchingNextPage,
    navigateToEmailId,
    orderedIds,
  ]);

  const goToEmail = useCallback(
    (direction: "prev" | "next") => {
      const nextIndex =
        direction === "next" ? currentIndex + 1 : currentIndex - 1;
      const nextId = orderedIds[nextIndex];
      if (nextId) {
        navigateToEmailId(nextId);
        return;
      }

      if (
        direction === "next" &&
        currentIndex >= 0 &&
        hasNextPage &&
        fetchNextPage &&
        !isFetchingNextPage
      ) {
        pendingNextAfterFetchRef.current = true;
        setIsLoadingNextEmail(true);
        void fetchNextPage().catch(() => {
          pendingNextAfterFetchRef.current = false;
          setIsLoadingNextEmail(false);
        });
      }
    },
    [
      currentIndex,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      navigateToEmailId,
      orderedIds,
    ],
  );

  const goBack = onClose ?? (() => router.history.back());

  const threadQuery = useQuery({
    queryKey: emailQueryKeys.thread(currentEmail.threadId ?? "none"),
    queryFn: () =>
      currentEmail.threadId
        ? fetchEmailThread(currentEmail.threadId)
        : Promise.resolve([]),
    enabled: Boolean(currentEmail.threadId),
    staleTime: 60_000,
    gcTime: 2 * 60_000,
  });

  const emailIdentifier = {
    id: currentEmail.id,
    providerMessageId: currentEmail.providerMessageId,
    mailboxId: currentEmail.mailboxId ?? mailboxId,
    labelIds: currentEmail.labelIds,
  };
  const threadIdentifier = currentEmail.threadId
    ? {
        threadId: currentEmail.threadId,
        mailboxId: currentEmail.mailboxId ?? mailboxId,
        labelIds: currentEmail.labelIds,
      }
    : null;
  const isInInbox = currentEmail.labelIds.includes("INBOX");
  const isSpam = currentEmail.labelIds.includes("SPAM");
  const primaryAction = isInInbox
    ? "archive"
    : isSpam
      ? "not-spam"
      : "move-to-inbox";
  const isStarred = currentEmail.labelIds.includes("STARRED");

  const threadMessages = useMemo(() => {
    if (!currentEmail.threadId) return [currentEmail];
    return threadQuery.data?.length ? threadQuery.data : [currentEmail];
  }, [currentEmail, threadQuery.data]);

  const handleForward = useCallback(
    (initial?: ComposeInitial) => {
      if (initial) {
        openCompose(initial);
        return;
      }
      const subject = currentEmail.subject
        ? currentEmail.subject.startsWith("Fwd:")
          ? currentEmail.subject
          : `Fwd: ${currentEmail.subject}`
        : "Fwd:";
      const bodyHtml = buildForwardedEmailHtml(currentEmail);
      openCompose({ subject, bodyHtml });
    },
    [currentEmail, openCompose],
  );

  useShortcuts("email-detail", {
    "detail:next": {
      action: () => goToEmail("next"),
      enabled: canNavigateNext,
    },
    "detail:next-arrow": {
      action: () => goToEmail("next"),
      enabled: canNavigateNext,
    },
    "detail:prev": {
      action: () => goToEmail("prev"),
      enabled: hasPrev,
    },
    "detail:prev-arrow": {
      action: () => goToEmail("prev"),
      enabled: hasPrev,
    },
    "action:reply": () => contentRef.current?.triggerReply(),
    "action:compose": () => openCompose(),
    "action:forward": () => handleForward(),
    "action:archive": () => {
      void executeEmailAction(
        primaryAction,
        [currentEmail.id],
        threadIdentifier ?? undefined,
        { identifiers: [emailIdentifier], onVisible: goBack },
      );
    },
    "action:trash": () => {
      void executeEmailAction(
        "trash",
        [currentEmail.id],
        threadIdentifier ?? undefined,
        {
          identifiers: [emailIdentifier],
          onVisible: goBack,
        },
      );
    },
    "action:star": () => {
      void executeEmailAction(
        isStarred ? "unstar" : "star",
        [currentEmail.id],
        undefined,
        {
          identifiers: [emailIdentifier],
        },
      );
    },
    "action:toggle-read": () => {
      void executeEmailAction(
        currentEmail.isRead ? "mark-unread" : "mark-read",
        [currentEmail.id],
        threadIdentifier ?? undefined,
        { identifiers: [emailIdentifier] },
      );
    },
    "action:reply-all": () => contentRef.current?.triggerReply(),
    "action:esc": () => goBack(),
  });

  const content = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <EmailDetailContent
        ref={contentRef}
        email={currentEmail}
        threadMessages={threadMessages}
        threadError={threadQuery.isError}
        onClose={goBack}
        onBack={goBack}
        onPrev={() => goToEmail("prev")}
        onNext={() => goToEmail("next")}
        hasPrev={hasPrev}
        hasNext={canNavigateNext}
        onForward={handleForward}
        onAction={executeEmailAction}
      />
    </div>
  );

  return embedded ? content : <MailboxPage>{content}</MailboxPage>;
}
