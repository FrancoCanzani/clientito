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
} from "../types";
import type { EmailThreadItem } from "../types";
import { ComposeEmailFields } from "../compose/compose-email-fields";
import { useComposeEmail } from "../compose/compose-email-state";
import {
 buildReplyInitial,
 pickReplySource,
} from "../utils/reply-compose";

export type QuickReplyHandle = {
 scrollIntoViewAndFocus: (draft?: string) => void;
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
 <div className="overflow-hidden border border-border/40 bg-card shadow-xs">
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
 <div className="flex max-h-[60vh] flex-col overflow-hidden border border-border/40 bg-card shadow-xs">
 <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2">
 <ArrowBendUpLeftIcon className="size-3.5 text-muted-foreground" />
 <span className="flex-1 text-xs text-muted-foreground">Reply</span>
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
