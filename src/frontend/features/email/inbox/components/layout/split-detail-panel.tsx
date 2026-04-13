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
  EmailListResponse,
} from "@/features/email/inbox/types";
import { buildForwardedEmailHtml } from "@/features/email/inbox/utils/build-forwarded-html";
import { markEmailOpened } from "@/features/email/inbox/utils/open-email";
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
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

export function SplitDetailPanel({
  emailId,
  mailboxId,
  view,
  onClose,
  onNavigate,
}: {
  emailId: string;
  mailboxId: number;
  view: string;
  onClose: () => void;
  onNavigate: (nextId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { openCompose } = useInboxCompose();
  const contentRef = useRef<EmailDetailContentHandle>(null);

  const detailQuery = useQuery({
    queryKey: queryKeys.emails.detail(emailId),
    queryFn: () => fetchEmailDetail(emailId, { mailboxId, view }),
    staleTime: 60_000,
  });

  const email = detailQuery.data;

  useEffect(() => {
    if (!email) return;
    markEmailOpened(queryClient, email);
    setFocusedEmail({
      id: email.id,
      fromAddr: email.fromAddr,
      fromName: email.fromName,
      subject: email.subject,
      threadId: email.threadId,
      mailboxId: email.mailboxId,
    });
    return () => clearFocusedEmail();
  }, [email?.id, queryClient]);

  const orderedEmails = useMemo(() => {
    const cached = queryClient.getQueryData<InfiniteData<EmailListResponse>>([
      "emails",
      view,
      mailboxId,
    ]);
    return cached?.pages.flatMap((page) => page.data) ?? [];
  }, [queryClient, mailboxId, view]);

  const orderedIds = orderedEmails.map((item) => item.id);
  const currentIndex = orderedIds.indexOf(emailId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < orderedIds.length - 1;

  const goToEmail = useCallback(
    (direction: "prev" | "next") => {
      const nextIndex =
        direction === "next" ? currentIndex + 1 : currentIndex - 1;
      const nextId = orderedIds[nextIndex];
      if (nextId) onNavigate(nextId);
    },
    [currentIndex, orderedIds, onNavigate],
  );

  const threadQuery = useQuery({
    queryKey: queryKeys.emails.thread(email?.threadId ?? ""),
    queryFn: () => fetchEmailThread(email!.threadId!),
    enabled: Boolean(email?.threadId),
    staleTime: 60_000,
  });

  const emailPatchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patchEmail>[1]) =>
      patchEmail(emailId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.emails.detail(emailId),
      });
    },
  });

  const threadMessages = useMemo(() => {
    if (!email) return [];
    if (!email.threadId) return [email];
    return threadQuery.data?.length ? threadQuery.data : [email];
  }, [email, threadQuery.data]);

  const handleForward = useCallback(
    (initial?: ComposeInitial) => {
      if (!email) return;
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

  const isInInbox = email?.labelIds.includes("INBOX") ?? false;
  const isStarred = email?.labelIds.includes("STARRED") ?? false;

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
    f: () => handleForward(),
    e: () => {
      emailPatchMutation.mutate(
        { archived: isInInbox },
        {
          onSuccess: () => {
            toast.success(isInInbox ? "Marked as done" : "Moved to inbox");
            onClose();
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
            onClose();
          },
        },
      );
    },
    s: () => {
      emailPatchMutation.mutate({ starred: !isStarred });
    },
    u: () => {
      if (email) emailPatchMutation.mutate({ isRead: !email.isRead });
    },
    Escape: onClose,
  });

  if (detailQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Email not found
      </div>
    );
  }

  return (
    <EmailDetailContent
      ref={contentRef}
      email={email}
      threadMessages={threadMessages}
      threadError={threadQuery.isError}
      onClose={onClose}
      onBack={onClose}
      onPrev={() => goToEmail("prev")}
      onNext={() => goToEmail("next")}
      hasPrev={hasPrev}
      hasNext={hasNext}
      onForward={handleForward}
    />
  );
}
