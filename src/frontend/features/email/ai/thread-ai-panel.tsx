import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EmailThreadItem } from "@/features/email/mail/shared/types";
import { createReplyDraft } from "./mutations";
import { aiQueryKeys } from "./query-keys";
import { fetchThreadSummary } from "./queries";
import { getLatestThreadMessage } from "./types";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";

export function canShowThreadSummary({
  mailboxId,
  threadId,
  messages,
}: {
  mailboxId: number | null;
  threadId: string | null;
  messages: EmailThreadItem[];
}) {
  const usableMessages = messages.filter((message) => !message.isDraft);
  const latestMessage = getLatestThreadMessage(usableMessages);
  const shouldSkipSummary = Boolean(
    latestMessage &&
      (latestMessage.unsubscribeUrl ||
        latestMessage.unsubscribeEmail ||
        latestMessage.labelIds.includes("CATEGORY_PROMOTIONS")),
  );
  const hasBodies = usableMessages.every(
    (message) =>
      message.bodyText !== null ||
      message.bodyHtml !== null ||
      message.resolvedBodyText !== null ||
      message.resolvedBodyHtml !== null,
  );

  return Boolean(
    mailboxId &&
      threadId &&
      usableMessages.length > 0 &&
      hasBodies &&
      !shouldSkipSummary,
  );
}

export function ThreadAiPanel({
  mailboxId,
  threadId,
  messages,
  onUseDraft,
  allowDraft = true,
}: {
  mailboxId: number | null;
  threadId: string | null;
  messages: EmailThreadItem[];
  onUseDraft: (draft: string) => void;
  allowDraft?: boolean;
}) {
  const usableMessages = messages.filter((message) => !message.isDraft);
  const queryClient = useQueryClient();
  const accountsQuery = useMailboxes();
  const account =
    accountsQuery.data?.accounts.find((entry) => entry.mailboxId === mailboxId) ??
    null;
  const selfEmails = new Set(
    [account?.email, account?.gmailEmail, account && getMailboxDisplayEmail(account)]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase()),
  );
  const latestMessage = getLatestThreadMessage(usableMessages);
  const enabled = canShowThreadSummary({ mailboxId, threadId, messages });
  const summaryQuery = useQuery({
    queryKey: aiQueryKeys.threadSummary(
      mailboxId!,
      threadId!,
      usableMessages[usableMessages.length - 1]?.providerMessageId ?? "none",
      usableMessages.length,
    ),
    queryFn: () =>
      fetchThreadSummary({
        mailboxId: mailboxId!,
        threadId: threadId!,
        messages: usableMessages,
      }),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const draftMutation = useMutation({
    mutationFn: () =>
      queryClient.fetchQuery({
        queryKey: aiQueryKeys.replyDraft(
          mailboxId!,
          threadId!,
          latestMessage?.providerMessageId ?? "none",
          usableMessages.length,
        ),
        queryFn: () =>
          createReplyDraft({
            mailboxId: mailboxId!,
            threadId: threadId!,
            messages: usableMessages,
          }),
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      }),
    onSuccess: (draft) => onUseDraft(draft.body),
  });

  if (!enabled) return null;

  return (
    <section className="border border-border/40 bg-card p-3 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium">Summary</p>
          {summaryQuery.isPending ? (
            <p className="mt-1 text-xs text-muted-foreground">Summarizing…</p>
          ) : summaryQuery.isError ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Summary unavailable.
            </p>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">
              <p className="leading-relaxed">{summaryQuery.data.summary}</p>
            </div>
          )}
        </div>
        {allowDraft &&
          latestMessage &&
          !selfEmails.has(latestMessage.fromAddr.toLowerCase()) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={draftMutation.isPending}
            onClick={() => draftMutation.mutate()}
          >
            {draftMutation.isPending ? "Drafting…" : "Draft reply"}
          </Button>
        )}
      </div>
    </section>
  );
}
