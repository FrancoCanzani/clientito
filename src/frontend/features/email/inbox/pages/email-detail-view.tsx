import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import {
  EmailDetailContent,
  type EmailDetailContentHandle,
} from "@/features/email/inbox/components/thread/email-detail-content";
import { patchEmail } from "@/features/email/inbox/mutations";
import {
  fetchEmailDetail,
  fetchEmailThread,
} from "@/features/email/inbox/queries";
import type {
  ComposeInitial,
  EmailDetailItem,
  EmailListPage,
} from "@/features/email/inbox/types";
import { buildForwardedEmailHtml } from "@/features/email/inbox/utils/build-forwarded-html";
import { openEmail as openInboxEmail } from "@/features/email/inbox/utils/open-email";
import { isEmailListInfiniteData } from "@/features/email/inbox/utils/email-list-cache";
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
import { useUndoAction } from "@/features/email/inbox/hooks/use-undo-action";

export function EmailDetailView({
  email,
  mailboxId,
  emailId,
  view,
  onNavigateToEmail,
}: {
  email: EmailDetailItem;
  mailboxId: number;
  emailId: string;
  view: string;
  onNavigateToEmail: (nextEmailId: string) => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openCompose } = useInboxCompose();
  const contentRef = useRef<EmailDetailContentHandle>(null);

  const emailQuery = useQuery({
    queryKey: emailQueryKeys.detail(emailId),
    queryFn: () =>
      fetchEmailDetail(emailId, {
        mailboxId,
        view,
      }),
    initialData: email,
    staleTime: 60_000,
    gcTime: 2 * 60_000,
  });
  const currentEmail = emailQuery.data ?? email;

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

  const orderedIds = orderedEmails.map((item) => item.id);
  const orderedEmailById = new Map(
    orderedEmails.map((item) => [item.id, item]),
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
          { context: view, replace: true },
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
    ],
  );

  const goBack = () => {
    router.history.back();
  };

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

  const emailPatchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patchEmail>[1]) =>
      patchEmail(emailIdentifier, payload),
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
        action: () => patchEmail(emailIdentifier, { archived: isInInbox }),
        onAction: goBack,
        message: isInInbox ? "Marked as done" : "Moved to inbox",
      });
    },
    "#": () => {
      undoAction({
        action: () => patchEmail(emailIdentifier, { trashed: true }),
        onAction: goBack,
        message: "Moved to trash",
      });
    },
    s: () => {
      emailPatchMutation.mutate({ starred: !isStarred });
    },
    u: () => {
      emailPatchMutation.mutate({ isRead: !currentEmail.isRead });
    },
    Escape: () => router.history.back(),
  });

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
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
    </div>
  );
}
