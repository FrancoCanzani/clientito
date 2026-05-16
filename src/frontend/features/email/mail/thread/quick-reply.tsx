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
 EmailDetailItem,
 EmailListItem,
} from "@/features/email/mail/shared/types";
import type { EmailThreadItem } from "@/features/email/mail/shared/types";
import { ComposeEmailFields } from "@/features/email/mail/compose/compose-email-fields";
import { useComposeEmail } from "@/features/email/mail/compose/compose-email-state";
import {
 buildReplyInitial,
 pickReplySource,
} from "@/features/email/mail/thread/reply-compose";

export type QuickReplyMode = "reply" | "reply-all";

export type QuickReplyOptions = {
 draft?: string;
 replyTo?: EmailThreadItem;
 mode?: QuickReplyMode;
};

export type QuickReplyHandle = {
 scrollIntoViewAndFocus: (options?: QuickReplyOptions | string) => void;
};

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
 const [replyToOverride, setReplyToOverride] = useState<EmailThreadItem | null>(
 null,
 );
 const [mode, setMode] = useState<QuickReplyMode>("reply");
 const containerRef = useRef<HTMLDivElement>(null);

 useImperativeHandle(ref, () => ({
 scrollIntoViewAndFocus: (options) => {
 const normalized: QuickReplyOptions | undefined =
 typeof options === "string" ? { draft: options } : options;
 if (normalized?.draft) {
 setPendingDraft({ id: Date.now(), text: normalized.draft });
 }
 setReplyToOverride(normalized?.replyTo ?? null);
 setMode(normalized?.mode ?? "reply");
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
 <div className="overflow-hidden rounded border border-border/40 bg-card shadow-xs">
 <button
 type="button"
 onClick={() => setOpen(true)}
 className="flex w-full items-center justify-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
 >
 Click here to reply
 </button>
 </div>
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
 replyToOverride={replyToOverride}
 mode={mode}
 onDraftApplied={() => setPendingDraft(null)}
 onClose={() => {
 setOpen(false);
 setReplyToOverride(null);
 setMode("reply");
 }}
 />
 </div>
 );
});

function QuickReplyComposer({
 email,
 detail,
 threadMessages,
 pendingDraft,
 replyToOverride,
 mode,
 onDraftApplied,
 onClose,
}: {
 email: EmailListItem;
 detail?: EmailDetailItem | null;
 threadMessages: EmailThreadItem[];
 pendingDraft: { id: number; text: string } | null;
 replyToOverride: EmailThreadItem | null;
 mode: QuickReplyMode;
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
 () => replyToOverride ?? pickReplySource(email, threadMessages, selfEmails),
 [email, replyToOverride, selfEmails, threadMessages],
 );
 const initial = useMemo(
 () =>
 buildReplyInitial(
 replySource,
 replySource.id === detail?.id ? detail : null,
 { replyAll: mode === "reply-all", selfEmails },
 ),
 [replySource, detail, mode, selfEmails],
 );
 const compose = useComposeEmail(initial, {
 onQueued: onClose,
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
 <div className="flex max-h-[60vh] flex-col overflow-hidden rounded border border-border/40 bg-card shadow-xs">
 <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2">
 <ArrowBendUpLeftIcon className="size-3.5 text-muted-foreground" />
 <span className="flex-1 text-xs text-muted-foreground">
 {mode === "reply-all" ? "Reply all" : "Reply"}
 </span>
 <button
 type="button"
 onClick={handleClose}
 className="p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
