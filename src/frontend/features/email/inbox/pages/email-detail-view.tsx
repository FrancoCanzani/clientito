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

  useEffect(() => {
    setFocusedEmail({
      id: email.id,
      fromAddr: email.fromAddr,
      fromName: email.fromName,
      subject: email.subject,
      threadId: email.threadId,
      mailboxId: email.mailboxId,
    });
    return () => clearFocusedEmail();
  }, [email.id, email.fromAddr, email.fromName, email.subject, email.threadId, email.mailboxId]);

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
    queryKey: queryKeys.emails.thread(email.threadId!),
    queryFn: () => fetchEmailThread(email.threadId!),
    enabled: Boolean(email.threadId),
    staleTime: 60_000,
  });

  const emailIdentifier = {
    id: email.id,
    providerMessageId: email.providerMessageId,
    mailboxId: email.mailboxId!,
    labelIds: email.labelIds,
  };

  const emailPatchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patchEmail>[1]) =>
      patchEmail(emailIdentifier, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.emails.detail(email.id) });
      void router.invalidate();
    },
  });

  const isInInbox = email.labelIds.includes("INBOX");
  const isStarred = email.labelIds.includes("STARRED");

  const threadMessages = useMemo(() => {
    if (!email.threadId) return [email];
    return threadQuery.data?.length ? threadQuery.data : [email];
  }, [email, threadQuery.data]);

  const handleForward = useCallback(
    (initial?: ComposeInitial) => {
      if (initial) {
        openCompose(initial);
        return;
      }
      const subject = email.subject
        ? email.subject.startsWith("Fwd:")
          ? email.subject
          : `Fwd: ${email.subject}`
        : "Fwd:";
      const bodyHtml = buildForwardedEmailHtml(email);
      openCompose({ subject, bodyHtml });
    },
    [email, openCompose],
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
      emailPatchMutation.mutate({ isRead: !email.isRead });
    },
    Escape: () => router.history.back(),
  });

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <EmailDetailContent
          ref={contentRef}
          email={email}
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
