import { PageSpinner } from "@/components/page-spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { getComposerEditor } from "@/features/email/mail/compose/compose-editor-ref";
import { fetchEmailDetail } from "@/features/email/mail/data/thread-detail";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { useTriageQueue } from "@/features/email/triage/hooks/use-triage-queue";
import {
  TriageActionBar,
  TriageDone,
  TriageEmail,
  TriageProgressStrip,
  TriageReplyComposer,
  TriageShell,
} from "@/features/email/triage/pages/triage-components";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const route = getRouteApi("/_dashboard/$mailboxId/triage");

function getThreadContext(group: ThreadGroup) {
  const email = group.representative;
  if (!group.threadId || email.mailboxId == null) return undefined;
  return {
    threadId: group.threadId,
    mailboxId: email.mailboxId,
    labelIds: email.labelIds,
  };
}

export default function TriagePage() {
  const { mailboxId } = route.useParams();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();
  const snoozeButtonRef = useRef<HTMLButtonElement>(null);
  const { threadGroups, isLoading } = useMailViewData({
    view: "inbox",
    mailboxId,
  });

  const [replyOpen, setReplyOpen] = useState(false);
  const [unsubscribeConfirmOpen, setUnsubscribeConfirmOpen] = useState(false);
  const {
    triageIds,
    queue,
    cursorIndex,
    currentGroup,
    current,
    advance,
    goPrev,
  } = useTriageQueue({ threadGroups, isLoading });

  const currentDetailQuery = useQuery({
    queryKey: current
      ? emailQueryKeys.detail(current.id)
      : ["email", "triage", "detail", "none"],
    queryFn: () =>
      fetchEmailDetail(current!.id, {
        mailboxId: current!.mailboxId ?? undefined,
        view: "inbox",
      }),
    enabled: Boolean(current),
    staleTime: 30_000,
  });
  const currentDetail = currentDetailQuery.data ?? null;

  useEffect(() => {
    const next = queue[cursorIndex + 1]?.representative;
    if (!next) return;
    void queryClient.prefetchQuery({
      queryKey: emailQueryKeys.detail(next.id),
      queryFn: () =>
        fetchEmailDetail(next.id, {
          mailboxId: next.mailboxId ?? undefined,
          view: "inbox",
        }),
    });
  }, [cursorIndex, mailboxId, queue, queryClient]);

  const {
    executeEmailAction,
    snooze,
    todo,
    unsubscribe: unsubscribeMutation,
  } = useMailActions({
    view: "inbox",
    mailboxId,
  });

  const { openCompose } = useMailCompose();

  const archiveCurrent = useCallback(() => {
    if (!current || !currentGroup) return;
    void executeEmailAction(
      "archive",
      currentGroup.emails.map((email) => email.id),
      getThreadContext(currentGroup),
    );
  }, [current, currentGroup, executeEmailAction]);

  const trashCurrent = useCallback(() => {
    if (!current || !currentGroup) return;
    void executeEmailAction(
      "trash",
      currentGroup.emails.map((email) => email.id),
      getThreadContext(currentGroup),
    );
  }, [current, currentGroup, executeEmailAction]);

  const handleDone = useCallback(() => {
    archiveCurrent();
    advance();
  }, [advance, archiveCurrent]);

  const handleDelete = useCallback(() => {
    trashCurrent();
    advance();
  }, [advance, trashCurrent]);

  const handleReplyQueued = useCallback(() => {
    setReplyOpen(false);
    advance();
  }, [advance]);

  const handleTodo = useCallback(() => {
    if (!currentGroup) return;
    void todo
      .add(currentGroup.emails)
      .catch((error: Error) =>
        toast.error(error.message || "Failed to mark to-do"),
      );
    advance();
  }, [advance, currentGroup, todo]);

  const handleSnooze = useCallback(
    (timestamp: number) => {
      if (!current || current.mailboxId == null) return;
      void snooze(
        current.threadId != null
          ? {
              kind: "thread",
              thread: {
                threadId: current.threadId,
                mailboxId: current.mailboxId,
                labelIds: current.labelIds,
              },
            }
          : {
              kind: "email",
              identifier: {
                id: current.id,
                providerMessageId: current.providerMessageId,
                mailboxId: current.mailboxId,
                labelIds: current.labelIds,
              },
            },
        timestamp,
      );
      advance();
    },
    [advance, current, snooze],
  );

  const exitToInbox = useCallback(() => {
    void navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
    });
  }, [mailboxId, navigate]);

  useEffect(() => {
    if (!current || current.isRead) return;
    void executeEmailAction("mark-read", [current.id]);
  }, [current, executeEmailAction]);

  const focusComposerEditor = useCallback(() => {
    if (!current) return;
    const isMobile =
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 1024px)").matches;
    if (isMobile) setReplyOpen(true);
    requestAnimationFrame(() => {
      getComposerEditor()?.commands.focus();
    });
  }, [current]);

  useShortcuts(
    "triage",
    {
      "action:archive": () => handleDone(),
      "action:reply": () => focusComposerEditor(),
      "action:compose": () => openCompose(),
      "action:snooze": () => {
        snoozeButtonRef.current?.click();
      },
      "action:todo": () => handleTodo(),
      "action:trash": () => handleDelete(),
      "triage:advance": () => advance(),
      "triage:advance-arrow": () => advance(),
      "triage:advance-arrow-right": () => advance(),
      "triage:prev": () => goPrev(),
      "triage:prev-arrow": () => goPrev(),
      "triage:prev-arrow-left": () => goPrev(),
      "action:esc": () => {
        if (replyOpen) {
          setReplyOpen(false);
          return;
        }
        exitToInbox();
      },
    },
    { enabled: Boolean(current) },
  );

  if (isLoading) {
    return <TriageShell body={<PageSpinner />} footer={null} />;
  }

  if (!current) {
    return (
      <TriageShell
        body={<TriageDone processed={triageIds.size} onExit={exitToInbox} />}
        footer={null}
      />
    );
  }

  return (
    <>
      <TriageShell
        header={
          <TriageProgressStrip
            position={cursorIndex + 1}
            total={queue.length}
          />
        }
        body={
          <TriageEmail
            email={current}
            detail={currentDetail}
            remaining={queue.length - cursorIndex}
          />
        }
        side={
          <TriageReplyComposer
            key={current.id}
            email={current}
            detail={currentDetail}
            group={currentGroup}
            mobileOpen={replyOpen}
            onClose={() => setReplyOpen(false)}
            onQueued={handleReplyQueued}
          />
        }
        sideOpen={replyOpen}
        footer={
          <TriageActionBar
            onDone={handleDone}
            onDelete={handleDelete}
            onSnooze={handleSnooze}
            snoozeButtonRef={snoozeButtonRef}
            onKeep={advance}
            onReply={focusComposerEditor}
            onTodo={handleTodo}
            isTodo={todo.isTodo(current)}
            onUnsubscribe={() => setUnsubscribeConfirmOpen(true)}
            canUnsubscribe={Boolean(
              current.unsubscribeUrl || current.unsubscribeEmail,
            )}
            actionsPending={todo.isPending || unsubscribeMutation.isPending}
          />
        }
      />
      <AlertDialog
        open={unsubscribeConfirmOpen}
        onOpenChange={setUnsubscribeConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unsubscribe from {current.fromAddr}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You'll be removed from this mailing list. Existing emails from{" "}
              {current.fromAddr} will also be moved to Archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setUnsubscribeConfirmOpen(false);
                unsubscribeMutation.mutate(current, {
                  onSuccess: (result) => {
                    if (result.method !== "manual") handleDone();
                  },
                });
              }}
            >
              Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
