import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGatekeeperDecision, useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { formatInboxRowDate } from "@/features/email/inbox/utils/formatters";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useMemo } from "react";
import { toast } from "sonner";

type PendingSender = {
  fromAddr: string;
  fromName: string | null;
  latestDate: number;
  latestSubject: string | null;
  latestSnippet: string | null;
  pendingCount: number;
};

function buildPendingSenders(input: ReturnType<typeof useGatekeeperPending>["data"]): PendingSender[] {
  if (!input) return [];
  const bySender = new Map<string, PendingSender>();

  for (const email of input.items) {
    const key = email.fromAddr.trim().toLowerCase();
    const existing = bySender.get(key);
    if (!existing) {
      bySender.set(key, {
        fromAddr: email.fromAddr,
        fromName: email.fromName,
        latestDate: email.date,
        latestSubject: email.subject,
        latestSnippet: email.snippet,
        pendingCount: 1,
      });
      continue;
    }

    existing.pendingCount += 1;
    if (email.date > existing.latestDate) {
      existing.latestDate = email.date;
      existing.latestSubject = email.subject;
      existing.latestSnippet = email.snippet;
      existing.fromName = email.fromName;
      existing.fromAddr = email.fromAddr;
    }
  }

  return Array.from(bySender.values()).sort(
    (left, right) => right.latestDate - left.latestDate,
  );
}

export function GatekeeperReviewDialog({
  open,
  onOpenChange,
  mailboxId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxId: number;
}) {
  const pendingQuery = useGatekeeperPending(mailboxId, open);
  const decisionMutation = useGatekeeperDecision(mailboxId);

  const pendingSenders = useMemo(
    () => buildPendingSenders(pendingQuery.data),
    [pendingQuery.data],
  );

  const activeSender =
    decisionMutation.isPending && decisionMutation.variables?.fromAddr
      ? decisionMutation.variables.fromAddr.toLowerCase()
      : null;

  async function applyDecision(fromAddr: string, decision: "accept" | "reject") {
    try {
      const result = await decisionMutation.mutateAsync({ fromAddr, decision });
      if (decision === "accept") {
        toast.success(`Accepted ${result.fromAddr}`);
      } else if (result.providerBlocked) {
        toast.success(
          result.trashedCount > 0
            ? `Blocked ${result.fromAddr} and moved ${result.trashedCount} ${result.trashedCount === 1 ? "email" : "emails"} to trash`
            : `Blocked ${result.fromAddr}`,
        );
      } else {
        toast.warning(
          result.providerError
            ? `Blocked ${result.fromAddr} in Petit. Gmail block failed: ${result.providerError}`
            : `Blocked ${result.fromAddr} in Petit`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Decision failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Review New Senders</DialogTitle>
          <DialogDescription>
            Accept trusted first contacts, reject unknown senders before they enter your inbox.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {pendingQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <SpinnerGapIcon className="size-4 animate-spin" />
            </div>
          ) : pendingSenders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No pending senders right now.
            </p>
          ) : (
            <ul className="space-y-2">
              {pendingSenders.map((sender) => {
                const senderKey = sender.fromAddr.toLowerCase();
                const busy = activeSender === senderKey;
                const senderLabel = sender.fromName
                  ? `${sender.fromName} <${sender.fromAddr}>`
                  : sender.fromAddr;

                return (
                  <li
                    key={senderKey}
                    className="rounded-md border border-border/70 bg-background/90 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">{senderLabel}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {sender.latestSubject || sender.latestSnippet || "No subject"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {sender.pendingCount} pending • {formatInboxRowDate(sender.latestDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => applyDecision(sender.fromAddr, "accept")}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => applyDecision(sender.fromAddr, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
