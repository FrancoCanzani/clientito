import { PageContainer } from "@/components/page-container";
import { SnoozePicker } from "@/components/snooze-picker";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { MailActionButton } from "@/features/email/mail/mail-action-button";
import { MessageBody } from "@/features/email/mail/render/message-body";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { sendEmail } from "@/features/email/mail/mutations";
import { fetchEmailDetail } from "@/features/email/mail/queries";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type { EmailListItem } from "@/features/email/mail/types";
import { formatEmailDetailDate } from "@/features/email/mail/utils/formatters";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";

const route = getRouteApi("/_dashboard/$mailboxId/focus");

const QUICK_REPLY_LIMIT = 140;
const PREFETCH_THRESHOLD = 5;

function buildReplySubject(subject: string | null): string {
  if (!subject) return "Re:";
  return `Re: ${subject.replace(/^Re:\s*/i, "")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function textToReplyHtml(text: string): string {
  const escaped = escapeHtml(text.trim());
  if (!escaped) return "";
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

function getThreadContext(group: ThreadGroup) {
  const email = group.representative;
  if (!group.threadId || email.mailboxId == null) return undefined;
  return {
    threadId: group.threadId,
    mailboxId: email.mailboxId,
    labelIds: email.labelIds,
  };
}

export default function FocusPage() {
  const { mailboxId } = route.useParams();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();
  const snoozeButtonRef = useRef<HTMLButtonElement>(null);
  const {
    threadGroups,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMailViewData({
    view: "inbox",
    mailboxId,
  });

  const seenIdsRef = useRef<Set<string>>(new Set());
  const [focusIds, setFocusIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let changed = false;
    const next = new Set(focusIds);
    for (const group of threadGroups) {
      const id = group.representative.id;
      if (seenIdsRef.current.has(id)) continue;
      seenIdsRef.current.add(id);
      if (group.emails.some((email) => !email.isRead)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) setFocusIds(next);
  }, [threadGroups, focusIds]);

  const queue = useMemo(
    () => threadGroups.filter((group) => focusIds.has(group.representative.id)),
    [threadGroups, focusIds],
  );

  const [cursorId, setCursorId] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [unsubscribeConfirmOpen, setUnsubscribeConfirmOpen] = useState(false);

  const cursorIndex = useMemo(() => {
    if (!cursorId) return 0;
    const idx = queue.findIndex(
      (group) => group.representative.id === cursorId,
    );
    return idx === -1 ? 0 : idx;
  }, [cursorId, queue]);

  const currentGroup = queue[cursorIndex] ?? null;
  const current = currentGroup?.representative ?? null;

  useEffect(() => {
    if (!current && queue[0]) {
      setCursorId(queue[0].representative.id);
      return;
    }
    if (current && cursorId !== current.id) {
      setCursorId(current.id);
    }
  }, [current, cursorId, queue]);

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

  const advance = useCallback(() => {
    const nextEmail = queue[cursorIndex + 1]?.representative;
    const nearEnd = cursorIndex + 1 >= queue.length - PREFETCH_THRESHOLD;
    if (hasNextPage && !isFetchingNextPage && nearEnd) {
      void fetchNextPage();
    }
    if (nextEmail) {
      setCursorId(nextEmail.id);
      return;
    }
    if (hasNextPage) return;
    setCursorId(null);
  }, [cursorIndex, fetchNextPage, hasNextPage, isFetchingNextPage, queue]);

  const goPrev = useCallback(() => {
    const prev = queue[cursorIndex - 1]?.representative;
    if (prev) setCursorId(prev.id);
  }, [cursorIndex, queue]);

  const {
    executeEmailAction,
    snooze,
    todo,
    unsubscribe: unsubscribeMutation,
  } = useMailActions({
    view: "inbox",
    mailboxId,
  });

  const handleDone = useCallback(() => {
    if (!current || !currentGroup) return;
    void executeEmailAction(
      "archive",
      currentGroup.emails.map((email) => email.id),
      getThreadContext(currentGroup),
    );
    advance();
  }, [advance, current, currentGroup, executeEmailAction]);

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

  useHotkeys(
    {
      e: () => handleDone(),
      r: () => {
        if (current) setReplyOpen(true);
      },
      s: () => {
        snoozeButtonRef.current?.click();
      },
      t: () => handleTodo(),
      j: () => advance(),
      ArrowDown: () => advance(),
      ArrowRight: () => advance(),
      k: () => goPrev(),
      ArrowUp: () => goPrev(),
      ArrowLeft: () => goPrev(),
      Escape: () => {
        if (replyOpen) return;
        exitToInbox();
      },
    },
    { enabled: Boolean(current) && !replyOpen },
  );

  if (isLoading) {
    return <FocusShell body={null} footer={null} />;
  }

  if (!current) {
    return (
      <FocusShell
        body={<FocusDone processed={focusIds.size} onExit={exitToInbox} />}
        footer={null}
      />
    );
  }

  return (
    <>
      <FocusShell
        progress={{
          index: cursorIndex,
          total: queue.length,
          hasMore: hasNextPage,
        }}
        body={<FocusEmail key={current.id} email={current} />}
        footer={
          <FocusActionBar
            onDone={handleDone}
            onSnooze={handleSnooze}
            snoozeButtonRef={snoozeButtonRef}
            onKeep={advance}
            onReply={() => setReplyOpen(true)}
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
      <FocusQuickReply
        email={current}
        open={replyOpen}
        onOpenChange={setReplyOpen}
        onSent={handleDone}
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
              You will be removed from this mailing list when a one-click or
              mailto unsubscribe method is available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
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

function FocusShell({
  progress,
  body,
  footer,
}: {
  progress?: { index: number; total: number; hasMore: boolean };
  body: ReactNode;
  footer: ReactNode;
}) {
  return (
    <PageContainer>
    <div className="grid h-full w-full grid-rows-[auto_1fr_auto] bg-background">
      <header className="flex h-7 items-center justify-end px-4 text-xs text-muted-foreground tabular-nums">
        {progress && progress.total > 0 && (
          <span>
            {progress.index + 1}
            <span className="text-foreground/30">
              {" "}
              / {progress.total}
              {progress.hasMore ? "+" : ""}
            </span>
          </span>
        )}
      </header>
      <main className="min-h-0 overflow-y-auto">{body}</main>
      {footer}
    </div>
    </PageContainer>
  );
}

function FocusEmail({ email }: { email: EmailListItem }) {
  const { data: detail } = useQuery({
    queryKey: emailQueryKeys.detail(email.id),
    queryFn: () =>
      fetchEmailDetail(email.id, {
        mailboxId: email.mailboxId ?? undefined,
        view: "inbox",
      }),
    staleTime: 30_000,
  });

  const sender = email.fromName?.trim() || email.fromAddr;
  const senderEmail = email.fromName ? email.fromAddr : null;

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 pt-12 pb-16 sm:px-10">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium text-foreground/85">
              {sender}
            </span>
            {senderEmail && (
              <span className="truncate text-foreground/35">{senderEmail}</span>
            )}
          </div>
          <time className="shrink-0 tabular-nums">
            {formatEmailDetailDate(email.date)}
          </time>
        </div>
        <h1
          className="text-2xl leading-tight tracking-[-0.01em] text-foreground"
          style={{ fontFamily: "var(--reading-font)" }}
        >
          {email.subject?.trim() || "(no subject)"}
        </h1>
      </header>

      <div className="border-t border-border/40 pt-7">
        <div
          className="text-[0.95rem] leading-relaxed text-foreground/85"
          style={{ fontFamily: "var(--reading-font)" }}
        >
          <MessageBody detail={detail ?? null} />
        </div>
      </div>
    </article>
  );
}

function FocusActionBar({
  onDone,
  onSnooze,
  snoozeButtonRef,
  onKeep,
  onReply,
  onTodo,
  isTodo,
  onUnsubscribe,
  canUnsubscribe,
  actionsPending,
}: {
  onDone: () => void;
  onSnooze: (timestamp: number) => void;
  snoozeButtonRef: RefObject<HTMLButtonElement | null>;
  onKeep: () => void;
  onReply: () => void;
  onTodo: () => void;
  isTodo: boolean;
  onUnsubscribe: () => void;
  canUnsubscribe: boolean;
  actionsPending: boolean;
}) {
  return (
    <footer className="border-t border-border/40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-1.5 px-3 py-2 sm:px-10 sm:py-3">
        <MailActionButton label="Reply" shortcut="R" onClick={onReply} />
        <MailActionButton label="Done" shortcut="E" onClick={onDone} />
        <SnoozePicker onSnooze={onSnooze}>
          <Button
            ref={snoozeButtonRef}
            variant="secondary"
            size="sm"
            type="button"
          >
            <span>Snooze</span>
            <Kbd>S</Kbd>
          </Button>
        </SnoozePicker>
        <MailActionButton
          shortcut="T"
          label={isTodo ? "To-do*" : "To-do"}
          onClick={onTodo}
          disabled={actionsPending}
        />
        {canUnsubscribe && (
          <MailActionButton
            shortcut="U"
            label="Unsubscribe"
            onClick={onUnsubscribe}
            disabled={actionsPending}
          />
        )}
        <MailActionButton shortcut="J" label="Keep" onClick={onKeep} />
      </div>
    </footer>
  );
}

function FocusQuickReply({
  email,
  open,
  onOpenChange,
  onSent,
}: {
  email: EmailListItem;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setText("");
      setSending(false);
    }
  }, [open]);

  const remaining = QUICK_REPLY_LIMIT - text.length;
  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !sending && email.mailboxId != null;
  const recipient = email.fromName?.trim() || email.fromAddr;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await sendEmail({
        mailboxId: email.mailboxId ?? undefined,
        to: email.fromAddr,
        subject: buildReplySubject(email.subject),
        body: textToReplyHtml(text),
        threadId: email.threadId ?? undefined,
      });
      toast.success("Reply sent");
      onSent();
      onOpenChange(false);
    } catch (error) {
      setSending(false);
      toast.error(error instanceof Error ? error.message : "Failed to send");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 border-border/60 bg-background p-0 sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          textareaRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">
          Quick reply to {recipient}
        </DialogTitle>
        <div className="border-b border-border/40 px-5 py-3 text-xs text-muted-foreground">
          <span className="text-foreground/60">Reply to</span>{" "}
          <span className="font-medium text-foreground/80">{recipient}</span>
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) =>
            setText(event.target.value.slice(0, QUICK_REPLY_LIMIT))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onOpenChange(false);
            }
          }}
          placeholder={`A short reply to ${recipient}...`}
          rows={4}
          maxLength={QUICK_REPLY_LIMIT}
          className="w-full resize-none bg-transparent px-5 py-5 text-lg leading-snug outline-none placeholder:text-muted-foreground/50"
          style={{ fontFamily: "var(--reading-font)" }}
        />
        <footer className="flex items-center justify-between border-t border-border/40 px-5 py-2.5 text-xs text-muted-foreground">
          <span
            className={cn(
              "font-mono tabular-nums transition-colors duration-150",
              remaining <= 20 && "text-foreground",
            )}
          >
            {remaining}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void send()}
              className="flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 text-background transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
            >
              {sending ? "Sending..." : "Send"}
              <Kbd className="bg-transparent text-background/70">⌘↵</Kbd>
            </button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function FocusDone({
  processed,
  onExit,
}: {
  processed: number;
  onExit: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 pb-20 text-center">
      <p
        className="text-3xl tracking-[-0.015em] text-foreground"
        style={{ fontFamily: "var(--reading-font)" }}
      >
        Quiet.
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {processed === 0
          ? "No unread mail. All caught up."
          : `You focused ${processed} ${processed === 1 ? "email" : "emails"}.`}
      </p>
      <button
        type="button"
        onClick={onExit}
        className="mt-4 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Back to inbox
      </button>
    </div>
  );
}
