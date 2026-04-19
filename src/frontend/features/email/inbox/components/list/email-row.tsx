import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { fetchEmailDetail } from "@/features/email/inbox/queries";
import {
  getRowActions,
  type RowAction,
} from "@/features/email/inbox/utils/row-actions";
import { LabelChip } from "@/features/email/labels/components/label-chip";
import type { Label } from "@/features/email/labels/types";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { EmailAICategory } from "@/db/schema";
import {
  ArrowRightIcon,
  CalendarIcon,
  PaperclipIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { memo, useMemo, useRef, useState } from "react";
import type { EmailListItem } from "../../types";
import { formatEmailSnippet, formatInboxRowDate } from "../../utils/formatters";
import type { ThreadGroup } from "../../utils/group-emails-by-thread";

const MAX_VISIBLE_CHIPS = 2;

const AI_CATEGORY_CHIP: Record<
  EmailAICategory,
  { label: string; backgroundColor: string }
> = {
  action_required: {
    label: "Action Required",
    backgroundColor: "#f6c5be",
  },
  invoice: {
    label: "Invoice",
    backgroundColor: "#ffe6c7",
  },
  notification: {
    label: "Notification",
    backgroundColor: "#c9daf8",
  },
  newsletter: {
    label: "Newsletter",
    backgroundColor: "#b9e4d0",
  },
  fyi: {
    label: "FYI",
    backgroundColor: "#efefef",
  },
  unknown: {
    label: "Unknown",
    backgroundColor: "#cccccc",
  },
};

export const EmailRow = memo(function EmailRow({
  group,
  view,
  onOpen,
  onAction,
  isFocused = false,
  allLabels,
}: {
  group: ThreadGroup;
  view: string;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  isFocused?: boolean;
  allLabels?: Label[];
}) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);
  const [actionsMounted, setActionsMounted] = useState(false);
  const email = group.representative;
  const isStarred = email.labelIds.includes("STARRED");

  const userLabels = useMemo<Label[]>(() => {
    if (!allLabels) return [];
    const byGmailId = new Map(allLabels.map((l) => [l.gmailId, l]));
    const resolved: Label[] = [];
    for (const id of email.labelIds) {
      if (!id.startsWith("Label_")) continue;
      const label = byGmailId.get(id);
      if (label) resolved.push(label);
    }
    return resolved;
  }, [allLabels, email.labelIds]);

  const threadCount = group.threadCount;
  const rowActions = getRowActions(view, email);

  const participantLabel =
    view === "sent"
      ? email.toAddr
        ? `To: ${email.toAddr}`
        : "To: (unknown recipient)"
      : email.fromName || email.fromAddr;

  const subject = email.subject?.trim() || "(no subject)";
  const snippet = useMemo(
    () => formatEmailSnippet(email.snippet),
    [email.snippet],
  );
  const aiCategoryLabel = useMemo<Label | null>(() => {
    if (!email.aiCategory) return null;
    if (email.aiCategory === "unknown") return null;
    const config = AI_CATEGORY_CHIP[email.aiCategory];
    return {
      gmailId: `AI_${email.aiCategory}`,
      name: config.label,
      type: "system",
      textColor: null,
      backgroundColor: config.backgroundColor,
      messagesTotal: 0,
      messagesUnread: 0,
    };
  }, [email.aiCategory]);

  const handleMouseEnter = () => {
    if (!actionsMounted) setActionsMounted(true);
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;

    void queryClient.prefetchQuery({
      queryKey: queryKeys.emails.detail(email.id),
      queryFn: () =>
        fetchEmailDetail(email.id, {
          mailboxId: email.mailboxId ?? undefined,
          view,
        }),
      staleTime: 45_000,
      gcTime: 120_000,
    });
  };

  const runAction = (rowAction: RowAction) => {
    onAction(rowAction.action, [email.id]);
  };

  const visibleChips = userLabels.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenChipCount = userLabels.length - visibleChips.length;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex h-12 rounded-md w-full cursor-default items-center gap-3 pr-6 pl-16 text-left text-sm transition-colors hover:bg-muted md:px-6",
        isFocused && "bg-muted",
      )}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      onClick={() => onOpen(email)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(email);
        }
      }}
    >
        <div className="flex w-36 shrink-0 items-center gap-2 lg:w-44 xl:w-52">
          <span
            className={cn(
              "truncate text-sm",
              !email.isRead && "font-semibold text-foreground",
            )}
          >
            {participantLabel}
          </span>
          {!email.isRead && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-blue-500"
              aria-hidden
            />
          )}
          {threadCount > 1 && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              [{threadCount}]
            </span>
          )}
        </div>

        <div className="min-w-0 flex flex-1 items-center gap-1 text-sm">
          <span
            className={cn(
              "min-w-0 shrink truncate",
              !email.isRead && "font-medium text-foreground",
            )}
          >
            {subject}
          </span>
          {snippet && (
            <>
              <span className="shrink-0 text-muted-foreground" aria-hidden>
                —
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {snippet}
              </span>
            </>
          )}
        </div>

        {(aiCategoryLabel || visibleChips.length > 0) && (
          <div className="shrink-0 items-center gap-1 flex">
            {aiCategoryLabel && <LabelChip label={aiCategoryLabel} />}
            {visibleChips.map((label) => (
              <LabelChip key={label.gmailId} label={label} />
            ))}
            {hiddenChipCount > 0 && (
              <span className="text-[11px] leading-none text-muted-foreground">
                +{hiddenChipCount}
              </span>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {isStarred && (
            <StarIcon
              className="size-3.5 text-yellow-400"
              weight="fill"
              aria-hidden
            />
          )}
          {email.hasCalendar && <CalendarIcon className="size-3.5" aria-hidden />}
          {email.hasAttachment && (
            <PaperclipIcon className="size-3.5" aria-hidden />
          )}
        </div>

        <div className="relative flex h-8 w-32 shrink-0 items-center justify-end">
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground group-hover:invisible group-focus-within:invisible">
            {formatInboxRowDate(email.date)}
          </span>

          {actionsMounted && (
            <EmailRowActions
              rowActions={rowActions}
              onRunAction={runAction}
              onOpen={() => onOpen(email)}
              summary={email.aiSummary}
            />
          )}
        </div>
    </div>
  );
});

function EmailRowActions({
  rowActions,
  onRunAction,
  onOpen,
  summary,
}: {
  rowActions: RowAction[];
  onRunAction: (rowAction: RowAction) => void;
  onOpen: () => void;
  summary: string | null;
}) {
  const summaryText = summary?.trim() || null;

  return (
    <div
      className="absolute inset-y-0 right-0 flex items-center gap-0.5 rounded-md bg-muted px-1 shadow ring-1 ring-border/40 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
      onClick={(event) => event.stopPropagation()}
    >
      {rowActions.map((rowAction) => {
        const Icon = rowAction.icon;

        return (
          <IconButton
            key={rowAction.key}
            label={rowAction.label}
            shortcut={rowAction.shortcut}
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              onRunAction(rowAction);
            }}
          >
            <Icon className="size-3.5" weight={rowAction.iconWeight} />
          </IconButton>
        );
      })}
      {summaryText && (
        <HoverCard openDelay={120}>
          <HoverCardTrigger asChild>
            <Button
              type="button"
              aria-label="Summary"
              variant="ghost"
              size="icon-sm"
              className="font-semibold text-[10px]"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              S
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            align="end"
            className="w-80 text-xs leading-relaxed whitespace-pre-wrap"
          >
            {summaryText}
          </HoverCardContent>
        </HoverCard>
      )}
      <IconButton
        label="Open"
        shortcut="Enter"
        variant="ghost"
        size="icon-sm"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <ArrowRightIcon className="size-3.5" />
      </IconButton>
    </div>
  );
}
