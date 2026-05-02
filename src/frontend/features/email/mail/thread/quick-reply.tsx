import { ArrowBendUpLeftIcon, XIcon } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/use-auth";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import {
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ComposeInitial,
  EmailDetailItem,
  EmailListItem,
  EmailThreadItem,
} from "../types";
import { formatQuotedDate } from "../utils/formatters";
import { ComposeEmailFields } from "../compose/compose-email-fields";
import { useComposeEmail } from "../compose/compose-email-state";

export type QuickReplyHandle = {
  scrollIntoViewAndFocus: (draft?: string) => void;
};

function buildReplyInitial(
  email: EmailListItem,
  detail?: EmailDetailItem | null,
): ComposeInitial {
  const subject = email.subject
    ? `Re: ${email.subject.replace(/^Re:\s*/i, "")}`
    : "Re:";

  const originalFrom = email.fromName
    ? `${email.fromName} &lt;${email.fromAddr}&gt;`
    : email.fromAddr;
  const originalDate = formatQuotedDate(email.date);
  const originalBody =
    detail?.resolvedBodyHtml ?? detail?.resolvedBodyText ?? email.snippet ?? "";
  const quotedHtml = `<div data-forwarded-message="true"><div data-forwarded-header>On ${originalDate}, ${originalFrom} wrote:</div><div data-forwarded-original-body>${originalBody}</div></div>`;

  return {
    mailboxId: email.mailboxId,
    to: email.fromAddr,
    subject,
    bodyHtml: quotedHtml,
    threadId: email.threadId ?? undefined,
  };
}

function pickReplySource(
  fallback: EmailListItem,
  threadMessages: EmailThreadItem[],
  selfEmails: Set<string>,
): EmailListItem {
  const sorted = [...threadMessages].sort((left, right) => {
    if (right.date !== left.date) return right.date - left.date;
    return right.createdAt - left.createdAt;
  });
  return (
    sorted.find((message) => !selfEmails.has(message.fromAddr.toLowerCase())) ??
    sorted[0] ??
    fallback
  );
}

export const QuickReply = forwardRef<
  QuickReplyHandle,
  {
    email: EmailListItem;
    detail?: EmailDetailItem | null;
    threadMessages?: EmailThreadItem[];
  }
>(function QuickReply({ email, detail, threadMessages = [] }, ref) {
  const [open, setOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    id: number;
    text: string;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollIntoViewAndFocus: (draft?: string) => {
      if (draft) {
        setPendingDraft({
          id: Date.now(),
          text: draft,
        });
      }
      setOpen(true);
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({
          behavior: "auto",
          block: "end",
        });
      });
    },
  }));

  if (!open) {
    return (
      <div ref={containerRef} className="mt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-md border border-border/40 p-3 justify-center text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Click here to reply
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mt-6">
      <QuickReplyComposer
        email={email}
        detail={detail}
        threadMessages={threadMessages}
        pendingDraft={pendingDraft}
        onDraftApplied={() => setPendingDraft(null)}
        onClose={() => setOpen(false)}
      />
    </div>
  );
});

function QuickReplyComposer({
  email,
  detail,
  threadMessages,
  pendingDraft,
  onDraftApplied,
  onClose,
}: {
  email: EmailListItem;
  detail?: EmailDetailItem | null;
  threadMessages: EmailThreadItem[];
  pendingDraft: { id: number; text: string } | null;
  onDraftApplied: () => void;
  onClose: () => void;
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
    () => pickReplySource(email, threadMessages, selfEmails),
    [email, selfEmails, threadMessages],
  );
  const initial = useMemo(
    () => buildReplyInitial(replySource, replySource.id === detail?.id ? detail : null),
    [replySource, detail],
  );
  const compose = useComposeEmail(initial, {
    onSent: onClose,
  });
  const appliedDraftIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pendingDraft) return;
    if (compose.loadingDraft) return;
    if (appliedDraftIdRef.current === pendingDraft.id) return;
    compose.setBody(pendingDraft.text);
    appliedDraftIdRef.current = pendingDraft.id;
    onDraftApplied();
  }, [compose, compose.loadingDraft, onDraftApplied, pendingDraft]);

  const handleClose = () => {
    compose.clearDraft();
    onClose();
  };

  return (
    <div className="rounded-md border border-border overflow-hidden max-h-[60vh] flex flex-col">
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2">
        <ArrowBendUpLeftIcon className="size-3.5 text-muted-foreground" />
        <span className="flex-1 text-xs text-muted-foreground">Reply</span>
        <button
          type="button"
          onClick={handleClose}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Discard reply"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ComposeEmailFields
          compose={compose}
          onEscape={handleClose}
          editorAutoFocus
          showMailboxSelector={false}
        />
      </div>
    </div>
  );
}
