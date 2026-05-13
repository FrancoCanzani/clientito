import { PageContainer } from "@/components/page-container";
import { SnoozePicker } from "@/components/snooze-picker";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { AttachmentBar } from "@/features/email/mail/compose/attachment-bar";
import { ComposeEditor } from "@/features/email/mail/compose/compose-editor";
import { useComposeEmail } from "@/features/email/mail/compose/compose-email-state";
import { RecipientInput } from "@/features/email/mail/compose/recipient-input";
import { MessageBody } from "@/features/email/mail/render/message-body";
import type {
  EmailDetailItem,
  EmailListItem,
} from "@/features/email/mail/types";
import { formatEmailDetailDate } from "@/features/email/mail/utils/formatters";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import {
  buildReplyInitial,
  pickReplySource,
} from "@/features/email/mail/utils/reply-compose";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { useAuth } from "@/hooks/use-auth";
import { shortcutKey } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, type ReactNode, type RefObject } from "react";

export function TriageShell({
  header,
  body,
  side,
  sideOpen = false,
  footer,
}: {
  header?: ReactNode;
  body: ReactNode;
  side?: ReactNode;
  sideOpen?: boolean;
  footer: ReactNode;
}) {
  return (
    <PageContainer className="max-w-none">
      <div className="flex min-h-0 w-full flex-1 flex-col bg-background lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {body}
          </div>
          {footer}
        </div>
        {side && (
          <aside
            className={cn(
              "min-h-0",
              sideOpen
                ? "fixed inset-2 z-40 flex flex-col border border-border/40 bg-card"
                : "hidden",
              "lg:static lg:inset-auto lg:flex lg:w-2/5 lg:shrink-0 lg:flex-col lg:border-0 lg:border-l lg:border-border/40 lg:bg-card",
            )}
          >
            {side}
          </aside>
        )}
      </div>
    </PageContainer>
  );
}

export function TriageProgressStrip({
  position,
  total,
}: {
  position: number;
  total: number;
}) {
  const safeTotal = Math.max(total, 1);
  const clampedPos = Math.min(Math.max(position, 1), safeTotal);
  const pct = (clampedPos / safeTotal) * 100;
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border/40 bg-background px-3 md:px-6">
      <span className="shrink-0 text-xs">Triage</span>
      <div className="relative h-px flex-1 bg-border/60">
        <div
          className="absolute inset-y-0 left-0 bg-foreground/70 transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {clampedPos} / {safeTotal}
      </span>
    </div>
  );
}

export function TriageEmail({
  email,
  detail,
  remaining,
}: {
  email: EmailListItem;
  detail: EmailDetailItem | null;
  remaining: number;
}) {
  const senderLine = email.fromName?.trim()
    ? `${email.fromName.trim()} <${email.fromAddr}>`
    : email.fromAddr;
  const subject = email.subject?.trim() || "(no subject)";
  const formattedDate = formatEmailDetailDate(email.date);
  const recipient = detail?.toAddr ?? "me";
  const showCc = Boolean(detail?.ccAddr);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col p-3">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {remaining > 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 -bottom-1 top-2 border border-border/50 bg-background/70 shadow-xs"
          />
        )}
        {remaining > 2 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 -bottom-2 top-4 border border-border/40 bg-background/50"
          />
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={email.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="relative flex min-h-0 flex-1 flex-col overflow-y-auto border border-border/40 bg-card shadow-xs dark:border-white/10"
          >
            <header className="space-y-2 px-5 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <h1 className="min-w-0 text-sm font-medium text-foreground">
                  {subject}
                </h1>
                <span className="shrink-0 font-mono text-[10px] tracking-tighter tabular-nums text-muted-foreground">
                  {formattedDate}
                </span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <p className="min-w-0">
                    <span className="mr-1 font-medium text-foreground/70">
                      From
                    </span>
                    <span>{senderLine}</span>
                  </p>
                  <p className="min-w-0">
                    <span className="mr-1 font-medium text-foreground/70">
                      To
                    </span>
                    <span>{recipient}</span>
                  </p>
                  {showCc && (
                    <p className="min-w-0">
                      <span className="mr-1 font-medium text-foreground/70">
                        Cc
                      </span>
                      <span>{detail?.ccAddr}</span>
                    </p>
                  )}
                </div>
              </div>
            </header>
            <div className="border-t border-border/40 p-5">
              {detail ? (
                <MessageBody detail={detail} />
              ) : email.snippet ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {email.snippet}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/60">Loading...</p>
              )}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function TriageActionBar({
  onDone,
  onDelete,
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
  onDelete: () => void;
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
    <div className="flex h-14 shrink-0 items-center border-t border-border/40">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-2 px-6 sm:px-10">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onDone}
          className="px-3"
        >
          <span>Done</span>
          <Kbd>{shortcutKey("action:archive")}</Kbd>
        </Button>

        <SnoozePicker onSnooze={onSnooze}>
          <Button ref={snoozeButtonRef} variant="ghost" size="sm" type="button">
            <span>Snooze</span>
            <Kbd>{shortcutKey("action:snooze")}</Kbd>
          </Button>
        </SnoozePicker>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onTodo}
          disabled={actionsPending}
        >
          <span>{isTodo ? "To-do*" : "To-do"}</span>
          <Kbd>{shortcutKey("action:todo")}</Kbd>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onKeep}>
          <span>Keep</span>
          <Kbd>{shortcutKey("triage:advance")}</Kbd>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <span>Delete</span>
          <Kbd>{shortcutKey("action:trash")}</Kbd>
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onReply}
          className="lg:hidden"
        >
          <span>Reply</span>
          <Kbd>{shortcutKey("action:reply")}</Kbd>
        </Button>

        {canUnsubscribe && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onUnsubscribe}
            disabled={actionsPending}
            className="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <span>Unsubscribe</span>
            <Kbd>{shortcutKey("action:toggle-read")}</Kbd>
          </Button>
        )}
      </div>
    </div>
  );
}

export function TriageReplyComposer({
  email,
  detail,
  group,
  mobileOpen,
  onClose,
  onQueued,
}: {
  email: EmailListItem;
  detail: EmailDetailItem | null;
  group: ThreadGroup | null;
  mobileOpen: boolean;
  onClose: () => void;
  onQueued: () => void;
}) {
  const { user } = useAuth();
  const mailboxesQuery = useMailboxes();
  const selfEmails = useMemo(() => {
    const emails = new Set<string>();
    if (user?.email) emails.add(user.email.toLowerCase());
    for (const account of mailboxesQuery.data?.accounts ?? []) {
      const displayEmail = getMailboxDisplayEmail(account);
      if (displayEmail) emails.add(displayEmail.toLowerCase());
      if (account.email) emails.add(account.email.toLowerCase());
      if (account.gmailEmail) emails.add(account.gmailEmail.toLowerCase());
    }
    return emails;
  }, [mailboxesQuery.data?.accounts, user?.email]);
  const replySource = useMemo(
    () => pickReplySource(email, group?.emails ?? [email], selfEmails),
    [email, group?.emails, selfEmails],
  );
  const initial = useMemo(
    () =>
      buildReplyInitial(
        replySource,
        replySource.id === detail?.id ? detail : null,
      ),
    [detail, replySource],
  );
  const compose = useComposeEmail(initial, {
    onQueued,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fromLabel = useMemo(() => {
    const activeMailbox = compose.availableMailboxes.find(
      (account) => account.mailboxId === compose.mailboxId,
    );
    return activeMailbox ? getMailboxDisplayEmail(activeMailbox) : null;
  }, [compose.availableMailboxes, compose.mailboxId]);

  const showFromRow = compose.availableMailboxes.length > 1;

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-2 lg:hidden">
        <span className="text-xs text-muted-foreground">Reply</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close reply composer"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
      <div className="shrink-0 space-y-0.5 px-5 pt-6 pb-3 lg:pt-9">
        <div className="flex items-start gap-3 px-1 py-1.5">
          <span className="w-14 shrink-0 pt-1 text-xs text-muted-foreground/70">
            To
          </span>
          <div className="min-w-0 flex-1">
            <RecipientInput value={compose.to} onChange={compose.setTo} />
          </div>
        </div>
        {showFromRow && (
          <TriageComposerRow label="From">
            <span className="block min-w-0 truncate text-sm text-foreground/80">
              {fromLabel ?? "Current mailbox"}
            </span>
          </TriageComposerRow>
        )}
        <TriageComposerRow label="Subject">
          <input
            value={compose.subject}
            onChange={(event) => compose.setSubject(event.target.value)}
            aria-label="Subject"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </TriageComposerRow>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/40 px-5 py-4">
        <ComposeEditor
          initialContent={compose.body}
          onChange={compose.setBody}
          onSend={() => {
            if (compose.canSend) compose.send();
          }}
          className="min-h-80 text-sm leading-relaxed"
          autoFocus={mobileOpen}
        />
      </div>
      {(compose.attachments.files.length > 0 ||
        compose.attachments.uploading) && (
        <div className="shrink-0 border-t border-border/40 px-5 pt-2">
          <AttachmentBar
            files={compose.attachments.files}
            uploading={compose.attachments.uploading}
            onAddFiles={(files) => compose.attachments.addFiles(files)}
            onRemoveFile={compose.attachments.removeFile}
          />
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            compose.attachments.addFiles(event.target.files);
            event.target.value = "";
          }
        }}
      />
      <div className="flex h-12 shrink-0 items-center justify-between border-t border-border/40 px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={compose.attachments.uploading}
          aria-label="Attach files"
          title="Attach files"
        >
          <PaperclipIcon className="size-3" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => compose.send()}
          disabled={!compose.canSend || compose.isPending}
        >
          {compose.isPending ? "Sending..." : "Send"}
        </Button>
      </div>
    </section>
  );
}

function TriageComposerRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3 px-1 py-1.5">
      <span className="w-14 shrink-0 text-xs text-muted-foreground/70">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function TriageDone({
  processed,
  onExit,
}: {
  processed: number;
  onExit: () => void;
}) {
  return (
    <Empty className="pb-20">
      <EmptyHeader>
        <EmptyTitle>No emails</EmptyTitle>
        <EmptyDescription>
          {processed === 0
            ? "No unread mail. All caught up."
            : `You triaged ${processed} ${processed === 1 ? "email" : "emails"}.`}
        </EmptyDescription>
      </EmptyHeader>
      <button
        type="button"
        onClick={onExit}
        className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        Back to inbox
      </button>
    </Empty>
  );
}
