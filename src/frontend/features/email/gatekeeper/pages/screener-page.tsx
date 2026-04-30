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
      });
      continue;
    }

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
    </div>
  );

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title={headerTitle}
        isScrolled={isScrolled}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-3 py-3 md:px-6">
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
            <ul className="overflow-hidden rounded-md border border-border/70 bg-background/90">
              {pendingSenders.map((sender) => {
                const senderKey = sender.fromAddr.toLowerCase();
                const busy = activeSender === senderKey;
                const senderLabel = sender.fromName
                  ? `${sender.fromName} <${sender.fromAddr}>`
                  : sender.fromAddr;
                const latestSubject =
                  sender.latestSubject?.trim() || "No subject";
                const latestSnippet = sender.latestSnippet?.trim() ?? "";

                return (
                  <li
                    key={senderKey}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <div className="flex flex-col gap-3 px-3 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium">
                          {senderLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatInboxRowDate(sender.latestDate)}
                        </p>
                        <p className="truncate text-sm text-foreground/90">
                          {latestSubject}
                        </p>
                        {latestSnippet ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {latestSnippet}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:pl-3">
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
