import { Button } from "@/components/ui/button";
import { useEmailAiActions } from "@/features/email/inbox/hooks/use-email-ai-actions";
import { fetchEmailDetailAI } from "@/features/email/inbox/queries";
import type {
  EmailDetailIntelligence,
  EmailDetailItem,
  EmailSuspiciousFlag,
} from "@/features/email/inbox/types";
import { WarningIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";

export function EmailIntelligence({
  email,
  onReplyRequested,
}: {
  email: EmailDetailItem;
  onReplyRequested: (draft?: string) => void;
}) {
  const skipAi =
    email.direction === "sent" ||
    email.labelIds.includes("SENT") ||
    email.labelIds.includes("TRASH") ||
    email.labelIds.includes("SPAM");

  const detailAIQuery = useQuery({
    queryKey: ["email-ai-detail", email.id],
    queryFn: () => fetchEmailDetailAI(email.id),
    enabled: !skipAi,
  });
  const intelligence = detailAIQuery.data ?? null;
  const { handleReply } = useEmailAiActions({ onReplyRequested });

  if (skipAi) return null;
  if (detailAIQuery.isFetching && !intelligence) return <AiPanelLoading />;

  if (detailAIQuery.isError && !intelligence) {
    return (
      <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        Could not load AI overview.
      </p>
    );
  }

  if (!intelligence) return null;

  return <AiPanel intelligence={intelligence} onReply={handleReply} />;
}

function AiPanel({
  intelligence,
  onReply,
}: {
  intelligence: EmailDetailIntelligence;
  onReply: (draft?: string) => void;
}) {
  return (
    <section className="space-y-4 rounded-md border border-border/40 p-3">
      {intelligence.suspicious.isSuspicious && (
        <SuspiciousWarning suspicious={intelligence.suspicious} />
      )}

      {intelligence.summary && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium tracking-[-0.6px]">Overview</h3>
          <p className="text-xs tracking-[-0.2px] text-foreground/90">
            {intelligence.summary}
          </p>
        </div>
      )}

      {intelligence.replyDraft && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium tracking-[-0.6px]">
            Suggested reply
          </h3>
          <p className="text-xs tracking-[-0.2px] text-foreground/80 leading-relaxed">
            {intelligence.replyDraft}
          </p>
          <Button
            type="button"
            variant="outline"
            className="border-dashed"
            onClick={() => onReply(intelligence.replyDraft ?? undefined)}
          >
            Use draft
          </Button>
        </div>
      )}
    </section>
  );
}

function AiPanelLoading() {
  return (
    <section className="space-y-3 rounded-md border border-border/40 p-3">
      <div className="space-y-1.5">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </section>
  );
}

function SuspiciousWarning({
  suspicious,
}: {
  suspicious: EmailSuspiciousFlag;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
      <div className="flex min-w-0 gap-2.5">
        <WarningIcon className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-800">
            Suspicious email
          </p>
          <p className="text-sm text-foreground">
            {suspicious.reason ??
              "This message shows signs of phishing or impersonation."}
          </p>
          {suspicious.confidence && (
            <p className="text-xs text-amber-900/80">
              Confidence: {suspicious.confidence}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
