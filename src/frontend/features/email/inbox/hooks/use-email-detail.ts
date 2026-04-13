import {
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

type UseEmailDetailOptions = {
  email?: EmailDetailItem | null;
  emailId: string;
  mailboxId: number;
  view: string;
  onClose: () => void;
  onNavigateToEmail: (nextId: string) => void;
  fetchOnMount?: boolean;
};

export function useEmailDetail({
  email: providedEmail,
  emailId,
  mailboxId,
  view,
  onClose,
  onNavigateToEmail,
  fetchOnMount = false,
}: UseEmailDetailOptions) {
  const queryClient = useQueryClient();
  const { openCompose } = useInboxCompose();
  const contentRef = useRef<EmailDetailContentHandle>(null);

  const detailQuery = useQuery({
    queryKey: queryKeys.emails.detail(emailId),
    queryFn: () => fetchEmailDetail(emailId, { mailboxId, view }),
    staleTime: 60_000,
    enabled: fetchOnMount && !providedEmail,
  });

  const email = providedEmail ?? detailQuery.data ?? null;
  const isLoading = fetchOnMount && !providedEmail && detailQuery.isLoading;

  useEffect(() => {
    if (!email) return;
    setFocusedEmail({
      id: email.id,
      fromAddr: email.fromAddr,
      fromName: email.fromName,
      subject: email.subject,
      threadId: email.threadId,
      mailboxId: email.mailboxId,
    });
    return () => clearFocusedEmail();
  }, [email?.id, email?.fromAddr, email?.fromName, email?.subject, email?.threadId, email?.mailboxId]);

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
      if (nextId) onNavigateToEmail(nextId);
    },
    [currentIndex, orderedIds, onNavigateToEmail],
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
    c: () => openCompose(),
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
          fetchEmailDetail(neighborId, { mailboxId, view }),
      });
    }
  }, [currentIndex, orderedIds, queryClient, mailboxId, view]);

  return {
    email,
    isLoading,
    contentRef,
    threadMessages,
    threadError: threadQuery.isError,
    hasPrev,
    hasNext,
    goToEmail,
    handleForward,
    onClose,
  };
}
