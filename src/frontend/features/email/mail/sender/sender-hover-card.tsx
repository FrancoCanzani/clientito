import { Button } from "@/components/ui/button";
import { emitOpenInTab } from "@/features/email/inbox/hooks/tab-events";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { useSenderRecent } from "@/features/email/mail/sender/use-sender-recent";
import { useSenderStats } from "@/features/email/mail/sender/use-sender-stats";
import { formatInboxRowDate } from "@/features/email/mail/shared/utils/formatters";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

export function SenderHoverCard({
  email,
  fallbackName,
}: {
  email: string;
  fallbackName?: string | null;
}) {
  const { mailboxId: mailboxIdParam } = mailboxRoute.useParams();
  const mailboxId = Number(mailboxIdParam);
  const navigate = useNavigate();
  const { openCompose } = useMailCompose();

  const stats = useSenderStats(mailboxId, email);
  const recent = useSenderRecent(mailboxId, email);

  const displayName = fallbackName?.trim() || email;
  const isLoading = stats.isLoading || recent.isLoading;
  const count = stats.data?.count ?? 0;
  const recentRows = recent.data ?? [];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">
          {displayName}
        </div>
        {displayName !== email && (
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        {isLoading ? (
          <span className="inline-flex items-center gap-1">
            <SpinnerGapIcon className="size-3 animate-spin" />
            Loading
          </span>
        ) : count === 0 ? (
          "No recent activity"
        ) : (
          <>
            {count} {count === 1 ? "thread" : "threads"} · last 90 days
          </>
        )}
      </div>

      {recentRows.length > 0 && (
        <div className="flex flex-col">
          <div className="border-b border-border/40 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Recent
          </div>
          {recentRows.map((row) => (
            <button
              key={row.emailId}
              type="button"
              onClick={() => emitOpenInTab(row.emailId)}
              className="flex items-center justify-between gap-2 py-1 text-left text-xs hover:bg-muted"
            >
              <span className="truncate">
                {row.subject?.trim() || "(no subject)"}
              </span>
              <span className="shrink-0 font-mono text-xs tracking-tighter tabular-nums text-muted-foreground">
                {formatInboxRowDate(row.date)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-0.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            navigate({
              to: "/$mailboxId/inbox/search",
              params: { mailboxId: mailboxIdParam },
              search: { q: `from:${email}` },
            })
          }
        >
          See all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => openCompose({ mailboxId, to: email })}
        >
          Compose
        </Button>
      </div>
    </div>
  );
}
