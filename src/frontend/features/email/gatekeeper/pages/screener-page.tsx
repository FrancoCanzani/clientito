import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  useGatekeeperDecision,
  useGatekeeperPending,
} from "@/features/email/gatekeeper/queries";
import { formatInboxRowDate } from "@/features/email/inbox/utils/formatters";
import type { EmailListItem } from "@/features/email/inbox/types";
import { useIsScrolled } from "@/hooks/use-is-scrolled";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { toast } from "sonner";

const screenerRoute = getRouteApi("/_dashboard/$mailboxId/screener");

type PendingSender = {
  fromAddr: string;
  fromName: string | null;
  latestDate: number;
  latestSubject: string | null;
  latestSnippet: string | null;
  pendingCount: number;
};

function buildPendingSenders(items: EmailListItem[] | undefined): PendingSender[] {
  if (!items) return [];
  const bySender = new Map<string, PendingSender>();

  for (const email of items) {
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

export default function ScreenerPage() {
  const { mailboxId } = screenerRoute.useParams();
  const pendingQuery = useGatekeeperPending(mailboxId, true);
  const decisionMutation = useGatekeeperDecision(mailboxId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolled = useIsScrolled(scrollRef);

  const pendingSenders = useMemo(
    () => buildPendingSenders(pendingQuery.data?.items),
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
      } else if (result.requiresReconnect) {
        toast.warning(
          `Blocked ${result.fromAddr} in Duomo. Reconnect Gmail in Settings to enable Gmail blocking.`,
        );
      } else {
        toast.warning(
          result.providerError
            ? `Blocked ${result.fromAddr} in Duomo. Gmail block failed: ${result.providerError}`
            : `Blocked ${result.fromAddr} in Duomo`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Decision failed");
    }
  }

  const headerTitle = (
    <div className="flex items-center gap-2">
      <SidebarTrigger className="md:hidden -ml-1 size-8" />
      <span>Screener</span>
      {pendingSenders.length > 0 && (
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {pendingSenders.length}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title={headerTitle} isScrolled={isScrolled} />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Accept first contacts you trust. Reject senders you don't want
            reaching your inbox — they'll be moved to trash and blocked in
            Gmail.
          </p>

          {pendingQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <SpinnerGapIcon className="size-4 animate-spin" />
            </div>
          ) : pendingSenders.length === 0 ? (
            <Empty className="min-h-56 justify-center">
              <EmptyHeader>
                <EmptyTitle>No pending senders</EmptyTitle>
                <EmptyDescription>
                  New first-contact senders will show up here for review.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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
                        <p className="truncate text-sm font-medium">
                          {senderLabel}
                        </p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {sender.latestSubject || sender.latestSnippet || "No subject"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {sender.pendingCount} pending •{" "}
                          {formatInboxRowDate(sender.latestDate)}
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
      </div>
    </div>
  );
}
