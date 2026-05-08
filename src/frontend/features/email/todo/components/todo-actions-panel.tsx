import { SnoozePicker } from "@/components/snooze-picker";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { MailActionButton } from "@/features/email/mail/mail-action-button";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import type {
 ComposeInitial,
 EmailDetailItem,
 EmailListItem,
} from "@/features/email/mail/types";
import { buildForwardedEmailHtml } from "@/features/email/mail/utils/build-forwarded-html";
import { formatQuotedDate } from "@/features/email/mail/utils/formatters";
import { cn } from "@/lib/utils";

export function TodoActionsPanel({
 selectedEmail,
 detail,
 mailboxId,
 view,
 hasThreadError,
 className,
}: {
 selectedEmail: EmailListItem;
 detail: EmailDetailItem | null;
 mailboxId: number;
 view: string;
 hasThreadError: boolean;
 className?: string;
}) {
 const { openCompose } = useMailCompose();
 const { executeEmailAction, snooze, todo } = useMailActions({
 view,
 mailboxId,
 });

 const resolvedMailboxId = selectedEmail.mailboxId ?? mailboxId;
 const emailIdentifier = {
 id: selectedEmail.id,
 providerMessageId: selectedEmail.providerMessageId,
 mailboxId: resolvedMailboxId,
 labelIds: selectedEmail.labelIds,
 };
 const threadIdentifier = selectedEmail.threadId
 ? {
 threadId: selectedEmail.threadId,
 mailboxId: resolvedMailboxId,
 labelIds: selectedEmail.labelIds,
 }
 : null;

 const handleArchive = async () => {
 await executeEmailAction(
 "archive",
 [selectedEmail.id],
 threadIdentifier ?? undefined,
 );
 void todo.remove(selectedEmail);
 };

 const handleRemove = () => {
 void todo.remove(selectedEmail);
 };

 const handleSnooze = (timestamp: number) => {
 void snooze(
 threadIdentifier
 ? { kind: "thread", thread: threadIdentifier }
 : { kind: "email", identifier: emailIdentifier },
 timestamp,
 ).then(() => todo.remove(selectedEmail));
 };

 const handleReply = () => {
 openCompose(buildReplyInitial(detail ?? selectedEmail));
 };

 const handleForward = () => {
 if (!detail) {
 openCompose({
 mailboxId: selectedEmail.mailboxId ?? mailboxId,
 subject: selectedEmail.subject?.startsWith("Fwd:")
 ? selectedEmail.subject
 : `Fwd: ${selectedEmail.subject ?? ""}`.trim(),
 });
 return;
 }

 openCompose({
 mailboxId: detail.mailboxId ?? mailboxId,
 subject: detail.subject?.startsWith("Fwd:")
 ? detail.subject
 : `Fwd: ${detail.subject ?? ""}`.trim(),
 bodyHtml: buildForwardedEmailHtml(detail),
 });
 };

 const busy = todo.isPending;

 return (
 <aside
 className={cn(
 "shrink-0 border-t border-border/40 pt-2 md:w-44 md:border-0 md:pt-0",
 className,
 )}
 >
 <div className="flex flex-row flex-wrap justify-center gap-1.5 md:flex-col md:items-start md:justify-start md:sticky md:top-2">
 <MailActionButton
 label="Reply"
 shortcut="R"
 onClick={handleReply}
 disabled={busy}
 />
 <MailActionButton
 label="Forward"
 shortcut="F"
 onClick={handleForward}
 disabled={busy}
 />
 <SnoozePicker onSnooze={handleSnooze}>
 <Button variant="secondary" size="sm" type="button" disabled={busy}>
 <span>Snooze</span>
 <Kbd>S</Kbd>
 </Button>
 </SnoozePicker>
 <MailActionButton
 label="Done"
 shortcut="E"
 onClick={handleRemove}
 disabled={busy}
 />
 <MailActionButton
 label="Archive"
 shortcut="A"
 onClick={() => void handleArchive()}
 disabled={busy}
 />
 <MailActionButton
 label="Remove"
 shortcut="Del"
 onClick={handleRemove}
 disabled={busy}
 />
 {hasThreadError && (
 <p className="pt-2 text-[11px] text-muted-foreground">
 Thread unavailable.
 </p>
 )}
 </div>
 </aside>
 );
}

function buildReplyInitial(
 email: EmailListItem | EmailDetailItem,
): ComposeInitial {
 const subject = email.subject
 ? `Re: ${email.subject.replace(/^Re:\s*/i, "")}`
 : "Re:";
 const originalFrom = email.fromName
 ? `${email.fromName} &lt;${email.fromAddr}&gt;`
 : email.fromAddr;
 const originalDate = formatQuotedDate(email.date);
 const originalBody =
 "resolvedBodyHtml" in email
 ? (email.resolvedBodyHtml ??
 email.resolvedBodyText ??
 email.snippet ??
 "")
 : (email.snippet ?? "");
 const quotedHtml = `<div data-forwarded-message="true"><div data-forwarded-header>On ${originalDate}, ${originalFrom} wrote:</div><div data-forwarded-original-body>${originalBody}</div></div>`;

 return {
 mailboxId: email.mailboxId,
 to: email.fromAddr,
 subject,
 bodyHtml: quotedHtml,
 threadId: email.threadId ?? undefined,
 };
}
