import {
  EmailDetailContent,
  type EmailDetailContentHandle,
} from "@/features/email/inbox/components/thread/email-detail-content";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import {
  fetchEmailDetail,
  fetchEmailThread,
} from "@/features/email/inbox/queries";
import type {
  ComposeInitial,
  EmailDetailItem,
  EmailListResponse,
} from "@/features/email/inbox/types";
import { buildForwardedEmailHtml } from "@/features/email/inbox/utils/build-forwarded-html";
import { openEmail as openInboxEmail } from "@/features/email/inbox/utils/open-email";
import {
  setFocusedEmail,
  clearFocusedEmail,
} from "@/hooks/use-focused-email";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { queryKeys } from "@/lib/query-keys";
import { patchEmail } from "@/features/email/inbox/mutations";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

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
    queryKey: queryKeys.emails.detail(emailId),
    queryFn: () =>
      fetchEmailDetail(emailId, {
        mailboxId,
        view,
      }),
    initialData: email,
    staleTime: 60_000,
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
    const cached = queryClient.getQueryData<InfiniteData<EmailListResponse>>([
      "emails",
      view,
      mailboxId,
    ]);
    return cached?.pages.flatMap((page) => page.data) ?? [];
  }, [queryClient, mailboxId, view]);

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
        queryKey: queryKeys.emails.detail(neighborId),
        queryFn: () =>
          fetchEmailDetail(neighborId, {
            mailboxId,
            view,
          }),
      });
    }
  }, [currentIndex, orderedIds, queryClient, mailboxId, view]);

  const threadQuery = useQuery({
    queryKey: queryKeys.emails.thread(currentEmail.threadId!),
    queryFn: () => fetchEmailThread(currentEmail.threadId!),
    enabled: Boolean(currentEmail.threadId),
    staleTime: 60_000,
  });

  const emailIdentifier = {
    id: currentEmail.id,
    providerMessageId: currentEmail.providerMessageId,
    mailboxId: currentEmail.mailboxId!,
    labelIds: currentEmail.labelIds,
  };

  const emailPatchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patchEmail>[1]) =>
      patchEmail(emailIdentifier, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.emails.detail(currentEmail.id) });
      void router.invalidate();
    },
  });

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
    k: {
      enabled: hasPrev,
      onKeyDown: () => goToEmail("prev"),
    },
    r: () => contentRef.current?.triggerReply(),
    c: () => openCompose(),
    f: () => handleForward(),
    e: () => {
      emailPatchMutation.mutate(
        { archived: isInInbox },
        {
          onSuccess: () => {
            toast.success(isInInbox ? "Marked as done" : "Moved to inbox");
            goBack();
          },
        },
      );
    },
    "#": () => {
      emailPatchMutation.mutate(
        { trashed: true },
        {
          onSuccess: () => {
            toast.success("Moved to trash");
            goBack();
          },
        },
      );
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
