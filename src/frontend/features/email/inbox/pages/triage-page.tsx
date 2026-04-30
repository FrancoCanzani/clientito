import { SnoozePicker } from "@/components/snooze-picker";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import {
  patchEmail,
  patchThread,
  sendEmail,
} from "@/features/email/inbox/mutations";
import { MessageBody } from "@/features/email/inbox/components/renderer/message-body";
import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import { fetchEmailDetail } from "@/features/email/inbox/queries";
import type { EmailListItem } from "@/features/email/inbox/types";
import type { ThreadGroup } from "@/features/email/inbox/utils/group-emails-by-thread";
import { formatEmailDetailDate } from "@/features/email/inbox/utils/formatters";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";
import {
  ArrowBendUpLeftIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { toast } from "sonner";

const route = getRouteApi("/_dashboard/$mailboxId/triage");

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

export default function TriagePage() {
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
  } = useEmailData({
    view: "inbox",
    mailboxId,
  });

  // Triage processes the unread set you arrived with. Emails get marked read as
  // you walk through them, but they stay in the queue so you can re-visit until
  // you Done/Snooze them. New unread emails fetched mid-session are appended.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [triageIds, setTriageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let changed = false;
    const next = new Set(triageIds);
    for (const group of threadGroups) {
      const id = group.representative.id;
      if (seenIdsRef.current.has(id)) continue;
      seenIdsRef.current.add(id);
      if (group.emails.some((email) => !email.isRead)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) setTriageIds(next);
  }, [threadGroups, triageIds]);

  const queue = useMemo(
    () =>
      threadGroups.filter((group) =>
        triageIds.has(group.representative.id),
      ),
    [threadGroups, triageIds],
  );

  const [cursorId, setCursorId] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);

  const cursorIndex = useMemo(() => {
    if (!cursorId) return 0;
    const idx = queue.findIndex((group) => group.representative.id === cursorId);
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

  // Pre-fetch the next email's body so `j` feels instant.
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
    if (nextEmail) {
      setCursorId(nextEmail.id);
    } else {
      setCursorId(null);
    }
  }, [cursorIndex, queue]);

  const goPrev = useCallback(() => {
    const prev = queue[cursorIndex - 1]?.representative;
    if (prev) setCursorId(prev.id);
  }, [cursorIndex, queue]);

  const { executeEmailAction } = useEmailInboxActions({
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

  const handleSnooze = useCallback(
    (timestamp: number) => {
      if (!current || current.mailboxId == null) return;
      const mutation =
        current.threadId != null
          ? patchThread(
              {
                threadId: current.threadId,
                mailboxId: current.mailboxId,
                labelIds: current.labelIds,
              },
              { snoozedUntil: timestamp },
            )
          : patchEmail(
              {
                id: current.id,
                providerMessageId: current.providerMessageId,
                mailboxId: current.mailboxId,
                labelIds: current.labelIds,
              },
              { snoozedUntil: timestamp },
            );
      mutation.catch(() => toast.error("Failed to snooze"));
      toast.success("Snoozed");
      advance();
    },
    [advance, current],
  );

  const exitToInbox = useCallback(() => {
    void navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
    });
  }, [mailboxId, navigate]);

  // Mark unread emails as read when they become the current triage email.
  useEffect(() => {
    if (!current || current.isRead) return;
    void executeEmailAction("mark-read", [current.id]);
  }, [current, executeEmailAction]);

  // Auto-fetch next page when cursor approaches the end of the loaded queue.
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (cursorIndex >= queue.length - PREFETCH_THRESHOLD) {
      void fetchNextPage();
    }
  }, [cursorIndex, fetchNextPage, hasNextPage, isFetchingNextPage, queue.length]);

  useHotkeys(
    {
      e: () => handleDone(),
      r: () => {
        if (current) setReplyOpen(true);
      },
      s: () => {
        snoozeButtonRef.current?.click();
      },
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
    return (
      <TriageShell mailboxId={mailboxId} body={null} footer={null} />
    );
  }

  if (!current) {
    return (
      <TriageShell
        mailboxId={mailboxId}
        body={<TriageDone processed={triageIds.size} onExit={exitToInbox} />}
        footer={null}
      />
    );
  }

  return (
    <>
      <TriageShell
        mailboxId={mailboxId}
        progress={{
          index: cursorIndex,
          total: queue.length,
          hasMore: hasNextPage,
        }}
        body={<TriageEmail key={current.id} email={current} />}
        footer={
          <TriageActionBar
            onDone={handleDone}
            onSnooze={handleSnooze}
            snoozeButtonRef={snoozeButtonRef}
            onKeep={advance}
            onReply={() => setReplyOpen(true)}
          />
        }
      />
      <TriageQuickReply
        email={current}
        open={replyOpen}
        onOpenChange={setReplyOpen}
        onSent={handleDone}
      />
    </>
  );
}

function TriageShell({
  mailboxId,
  progress,
  body,
  footer,
}: {
  mailboxId: number;
  progress?: { index: number; total: number; hasMore: boolean };
  body: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid h-dvh w-full grid-rows-[auto_1fr_auto] bg-background">
      <header className="flex h-12 items-center justify-between border-b border-border/40 px-4 text-xs text-muted-foreground">
        <Link
          to="/$mailboxId/inbox"
          params={{ mailboxId }}
          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span>Inbox</span>
        </Link>
        <span className="font-medium tracking-wide uppercase text-foreground/50">
          Triage
        </span>
        <div className="flex items-center gap-3 tabular-nums">
          {progress && progress.total > 0 ? (
            <span>
              {progress.index + 1}
              <span className="text-foreground/30">
                {" "}
                / {progress.total}
                {progress.hasMore ? "+" : ""}
              </span>
            </span>
          ) : (
            <span className="opacity-0">0 / 0</span>
          )}
          <Kbd>Esc</Kbd>
        </div>
      </header>
      <main className="min-h-0 overflow-y-auto">{body}</main>
      {footer}
    </div>
  );
}

function TriageEmail({ email }: { email: EmailListItem }) {
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
              <span className="truncate text-foreground/35">
                {senderEmail}
              </span>
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
          <MessageBody detail={detail ?? null} readingMode="detox" />
        </div>
      </div>
    </article>
  );
}

function TriageActionBar({
  onDone,
  onSnooze,
  snoozeButtonRef,
  onKeep,
  onReply,
}: {
  onDone: () => void;
  onSnooze: (timestamp: number) => void;
  snoozeButtonRef: RefObject<HTMLButtonElement | null>;
  onKeep: () => void;
  onReply: () => void;
}) {
  return (
    <footer className="border-t border-border/40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-10">
        <TriageActionButton
          shortcut="R"
          label="Reply"
          icon={<ArrowBendUpLeftIcon className="size-3.5" />}
          onClick={onReply}
          accent
        />
        <TriageActionButton
          shortcut="E"
          label="Done"
          icon={<CheckIcon className="size-3.5" />}
          onClick={onDone}
        />
        <SnoozePicker onSnooze={onSnooze}>
          <button
            ref={snoozeButtonRef}
            type="button"
            className={triageActionClass()}
            aria-label="Snooze"
          >
            <span className="flex items-center gap-1.5">
              <ClockIcon className="size-3.5" />
              Snooze
            </span>
            <Kbd>S</Kbd>
          </button>
        </SnoozePicker>
        <TriageActionButton
          shortcut="→"
          label="Keep"
          icon={<ArrowRightIcon className="size-3.5" />}
          onClick={onKeep}
        />
      </div>
    </footer>
  );
}

function triageActionClass(accent = false) {
  return cn(
    "group flex flex-1 min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs transition-[transform,color,background-color,border-color,opacity] duration-[140ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]",
    accent
      ? "border-foreground/15 bg-foreground/5 text-foreground hover:border-foreground/30 hover:bg-foreground/8"
      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
  );
}

function TriageActionButton({
  shortcut,
  label,
  icon,
  onClick,
  accent = false,
}: {
  shortcut: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={triageActionClass(accent)}>
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <Kbd>{shortcut}</Kbd>
    </button>
  );
}

function TriageQuickReply({
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
        <DialogTitle className="sr-only">Quick reply to {recipient}</DialogTitle>
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

function TriageDone({
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
          : `You triaged ${processed} ${processed === 1 ? "email" : "emails"}.`}
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
