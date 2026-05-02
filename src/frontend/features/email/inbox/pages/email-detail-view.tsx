import { Button } from "@/components/ui/button";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import {
  EmailDetailContent,
  type EmailDetailContentHandle,
} from "@/features/email/mail/thread/email-detail-content";
import { patchEmail, patchThread } from "@/features/email/mail/mutations";
import {
  fetchEmailDetail,
  fetchEmailThread,
} from "@/features/email/mail/queries";
import type {
  ComposeInitial,
  EmailDetailItem,
  EmailListPage,
} from "@/features/email/mail/types";
import { buildForwardedEmailHtml } from "@/features/email/mail/utils/build-forwarded-html";
import { openEmail as openInboxEmail } from "@/features/email/mail/utils/open-email";
import { isEmailListInfiniteData } from "@/features/email/mail/utils/email-list-cache";
import { MailboxPage } from "@/features/email/shell/mailbox-page";
import { clearFocusedEmail, setFocusedEmail } from "@/hooks/use-focused-email";
import { useHotkeys } from "@/hooks/use-hotkeys";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useUndoAction } from "@/features/email/mail/hooks/use-undo-action";

export function EmailDetailView({
  mailboxId,
  emailId,
  view,
  onNavigateToEmail,
  onClose,
  embedded = false,
}: {
  mailboxId: number;
  emailId: string;
  view: string;
  onNavigateToEmail: (nextEmailId: string) => void;
  onClose?: () => void;
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
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="space-y-3 text-center">
          <p className="text-sm font-medium text-foreground">Unable to open email</p>
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
    return <div className="h-full w-full" />;
  }

  return (
    <EmailDetailPane
      email={emailQuery.data}
      mailboxId={mailboxId}
      emailId={emailId}
      view={view}
      onNavigateToEmail={onNavigateToEmail}
      onClose={onClose}
      embedded={embedded}
    />
  );
}

function EmailDetailPane({
  email,
  mailboxId,
  emailId,
  view,
  onNavigateToEmail,
  onClose,
  embedded,
}: {
  email: EmailDetailItem;
  mailboxId: number;
  emailId: string;
  view: string;
  onNavigateToEmail: (nextEmailId: string) => void;
  onClose?: () => void;
  embedded: boolean;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openCompose } = useMailCompose();
  const contentRef = useRef<EmailDetailContentHandle>(null);
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
    const snapshots = queryClient.getQueriesData<InfiniteData<EmailListPage>>({
      queryKey: emailQueryKeys.list(view, mailboxId),
    });
    const candidateLists = snapshots
      .map(([, data]) => data)
      .filter((data): data is InfiniteData<EmailListPage> =>
        isEmailListInfiniteData(data),
      )
      .map((data) => data.pages.flatMap((page) => page.emails))
      .filter((emails) => emails.length > 0);

    const containingCurrent = candidateLists.find((emails) =>
      emails.some((item) => item.id === emailId),
    );
    return containingCurrent ?? candidateLists[0] ?? [];
  }, [queryClient, mailboxId, view, emailId]);

  const orderedIds = useMemo(
    () => orderedEmails.map((item) => item.id),
    [orderedEmails],
  );
  const orderedEmailById = useMemo(
    () => new Map(orderedEmails.map((item) => [item.id, item])),
    [orderedEmails],
  );

  const currentIndex = orderedIds.indexOf(emailId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < orderedIds.length - 1;

  const goToEmail = useCallback(
    (direction: "prev" | "next") => {
      const nextIndex =
        direction === "next" ? currentIndex + 1 : currentIndex - 1;
      const nextId = orderedIds[nextIndex];
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
            presentation: embedded ? "panel" : "route",
            replace: true,
          },
        );
        return;
      }

      onNavigateToEmail(nextId);
    },
    [
      currentIndex,
      orderedIds,
      orderedEmailById,
      queryClient,
      navigate,
      mailboxId,
      view,
      onNavigateToEmail,
      embedded,
    ],
  );

  const goBack = onClose ?? (() => router.history.back());

  useEffect(() => {
    const previousId = currentIndex > 0 ? orderedIds[currentIndex - 1] : null;
    const nextId =
      currentIndex >= 0 && currentIndex < orderedIds.length - 1
        ? orderedIds[currentIndex + 1]
        : null;

    for (const neighborId of [previousId, nextId]) {
      if (!neighborId) continue;
      void queryClient.prefetchQuery({
        queryKey: emailQueryKeys.detail(neighborId),
        queryFn: () =>
          fetchEmailDetail(neighborId, {
            mailboxId,
            view,
          }),
        staleTime: 60_000,
        gcTime: 2 * 60_000,
      });
    }
  }, [currentIndex, orderedIds, queryClient, mailboxId, view]);

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
  const patchThreadOrEmail = (payload: Parameters<typeof patchEmail>[1]) =>
    threadIdentifier
      ? patchThread(threadIdentifier, payload)
      : patchEmail(emailIdentifier, payload);

  const emailPatchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patchEmail>[1]) =>
      patchEmail(emailIdentifier, payload),
  });
  const threadPatchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patchEmail>[1]) =>
      patchThreadOrEmail(payload),
  });

  const undoAction = useUndoAction();

  const isInInbox = currentEmail.labelIds.includes("INBOX");
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

  useHotkeys({
    j: {
      enabled: hasNext,
      onKeyDown: () => goToEmail("next"),
    },
    ArrowDown: {
      enabled: hasNext,
      onKeyDown: () => goToEmail("next"),
    },
    k: {
      enabled: hasPrev,
      onKeyDown: () => goToEmail("prev"),
    },
    ArrowUp: {
      enabled: hasPrev,
      onKeyDown: () => goToEmail("prev"),
    },
    r: () => contentRef.current?.triggerReply(),
    c: () => openCompose(),
    f: () => handleForward(),
    e: () => {
      undoAction({
        action: () => patchThreadOrEmail({ archived: isInInbox }),
        onAction: goBack,
        message: isInInbox ? "Marked as done" : "Moved to inbox",
      });
    },
    "#": () => {
      undoAction({
        action: () => patchThreadOrEmail({ trashed: true }),
        onAction: goBack,
        message: "Moved to trash",
      });
    },
    s: () => {
      emailPatchMutation.mutate({ starred: !isStarred });
    },
    u: () => {
      threadPatchMutation.mutate({ isRead: !currentEmail.isRead });
    },
    Escape: () => goBack(),
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
        hasNext={hasNext}
        onForward={handleForward}
      />
    </div>
  );

  return embedded ? content : <MailboxPage>{content}</MailboxPage>;
}
