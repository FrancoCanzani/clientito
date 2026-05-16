import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { draftQueryKeys } from "@/features/email/mail/shared/query-keys";
import type { EmailThreadItem } from "@/features/email/mail/shared/types";
import { formatEmailThreadDate } from "@/features/email/mail/shared/utils/formatters";
import { useQueryClient } from "@tanstack/react-query";
import { PencilSimpleIcon, TrashSimpleIcon } from "@phosphor-icons/react";

export function DraftThreadMessage({ draft }: { draft: EmailThreadItem }) {
 const { openCompose } = useMailCompose();
 const queryClient = useQueryClient();

 const handleContinue = () => {
 openCompose({
 composeKey: draft.draftComposeKey,
 mailboxId: draft.mailboxId ?? null,
 to: draft.toAddr ?? "",
 cc: draft.ccAddr ?? "",
 subject: draft.subject ?? "",
 bodyHtml: draft.bodyHtml ?? "",
 threadId: draft.threadId ?? undefined,
 });
 };

 const handleDiscard = async () => {
 if (draft.draftId == null) return;
 const userId = await getCurrentUserId();
 if (!userId) return;
 await localDb.deleteDraft(draft.draftId, userId);
 await queryClient.invalidateQueries({
 queryKey: ["thread-drafts", draft.threadId ?? "none"],
 });
 await queryClient.invalidateQueries({
 queryKey: draftQueryKeys.list(draft.mailboxId ?? null),
 });
 };

 return (
 <div className="border border-destructive/30 bg-card shadow-xs">
 <div className="flex items-center gap-2 border-b border-destructive/20 px-4 py-3">
 <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive ring-1 ring-destructive/40">
 Draft
 </span>
 <div className="min-w-0 flex-1">
 <p className="truncate text-xs text-muted-foreground">
 To: {draft.toAddr || "(no recipients)"}
 </p>
 </div>
 <span className="font-mono text-[10px] tracking-tighter tabular-nums text-muted-foreground">
 {formatEmailThreadDate(draft.date)}
 </span>
 </div>
 <div className="px-5 py-3 text-xs text-muted-foreground">
 {draft.snippet?.trim() || "(empty draft)"}
 </div>
 <div className="flex items-center gap-1 border-t border-destructive/20 px-3 py-1.5">
 <button
 type="button"
 onClick={handleContinue}
 className="inline-flex items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
 >
 <PencilSimpleIcon className="size-3.5" />
 <span>Continue editing</span>
 </button>
 <button
 type="button"
 onClick={handleDiscard}
 className="inline-flex items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
 >
 <TrashSimpleIcon className="size-3.5" />
 <span>Discard</span>
 </button>
 </div>
 </div>
 );
}
