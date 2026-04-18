import { SnoozePicker } from "@/components/snooze-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { patchEmail } from "@/features/email/inbox/mutations";
import { fetchEmailDetail } from "@/features/email/inbox/queries";
import {
  getRowActions,
  type RowAction,
} from "@/features/email/inbox/utils/row-actions";
import { LabelChip } from "@/features/email/labels/components/label-chip";
import type { Label } from "@/features/email/labels/types";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { PaperclipIcon, StarIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { EmailListItem } from "../../types";
import { formatEmailSnippet, formatInboxRowDate } from "../../utils/formatters";
import type { ThreadGroup } from "../../utils/group-emails-by-thread";

const MAX_VISIBLE_CHIPS = 2;

export const EmailRow = memo(function EmailRow({
  group,
  view,
  onOpen,
  onAction,
  isFocused = false,
  index,
  isSelected = false,
  onToggleSelect,
  anySelected = false,
  allLabels,
}: {
  group: ThreadGroup;
  view: string;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  isFocused?: boolean;
  index: number;
  isSelected?: boolean;
  onToggleSelect?: (id: string, index: number, shift: boolean) => void;
  anySelected?: boolean;
  allLabels?: Label[];
}) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);
  const [pendingConfirm, setPendingConfirm] = useState<RowAction | null>(null);
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
  const showCheckbox = anySelected || isSelected;

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
    if (rowAction.confirm) {
      setPendingConfirm(rowAction);
      return;
    }
    onAction(rowAction.action, [email.id]);
  };

  const visibleChips = userLabels.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenChipCount = userLabels.length - visibleChips.length;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "group flex h-12 rounded-md w-full cursor-default items-center gap-3 pr-6 pl-16 text-left text-sm transition-colors hover:bg-muted md:px-6",
          isFocused && "bg-muted",
          isSelected && "bg-primary/5 hover:bg-primary/10",
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
        <div
          className={cn(
            "flex w-10 shrink-0 items-center gap-1",
            !showCheckbox &&
              "pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            aria-label={isSelected ? "Deselect email" : "Select email"}
            checked={isSelected}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect?.(email.id, index, event.shiftKey);
            }}
          />
        </div>
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

        {visibleChips.length > 0 && (
          <div className="shrink-0 items-center gap-1 flex">
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
          {email.hasAttachment && (
            <PaperclipIcon className="size-3.5" aria-hidden />
          )}
        </div>

        <div className="relative flex h-8 w-28 shrink-0 items-center justify-end">
          <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground group-hover:invisible">
            {formatInboxRowDate(email.date)}
          </span>

          {actionsMounted && (
            <EmailRowActions
              email={email}
              rowActions={rowActions}
              onRunAction={runAction}
            />
          )}
        </div>
      </div>

      {pendingConfirm !== null && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingConfirm(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingConfirm.confirm?.title ?? "Are you sure?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingConfirm.confirm?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  onAction(pendingConfirm.action, [email.id]);
                  setPendingConfirm(null);
                }}
              >
                {pendingConfirm.confirm?.confirmLabel ?? "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
});

function EmailRowActions({
  email,
  rowActions,
  onRunAction,
}: {
  email: EmailListItem;
  rowActions: RowAction[];
  onRunAction: (rowAction: RowAction) => void;
}) {
  const snoozeMutation = useMutation({
    mutationFn: (timestamp: number | null) => {
      if (!email.mailboxId) throw new Error("Missing mailbox");
      return patchEmail(
        {
          id: email.id,
          providerMessageId: email.providerMessageId,
          mailboxId: email.mailboxId,
          labelIds: email.labelIds,
        },
        { snoozedUntil: timestamp },
      );
    },
    onSuccess: (_data, timestamp) => {
      toast.success(timestamp ? "Snoozed" : "Unsnoozed");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to snooze"),
  });

  return (
    <div
      className="absolute inset-y-0 right-0 hidden items-center gap-0.5 rounded-md bg-muted px-1 shadow ring-1 ring-border/40 group-hover:flex"
      onClick={(event) => event.stopPropagation()}
    >
      {rowActions.map((rowAction) => {
        const Icon = rowAction.icon;
        const iconEl = (
          <Icon
            className={cn(
              "size-3.5",
              rowAction.key === "star" && "text-yellow-500",
            )}
            weight={rowAction.iconWeight}
          />
        );

        if (rowAction.kind === "snooze") {
          return (
            <SnoozePicker
              key={rowAction.key}
              onSnooze={(timestamp) => snoozeMutation.mutate(timestamp)}
            >
              <IconButton
                label={rowAction.label}
                variant="ghost"
                size="icon-sm"
                onClick={(event) => event.stopPropagation()}
              >
                {iconEl}
              </IconButton>
            </SnoozePicker>
          );
        }

        if (rowAction.kind === "unsnooze") {
          return (
            <IconButton
              key={rowAction.key}
              label={rowAction.label}
              variant="ghost"
              size="icon-sm"
              onClick={(event) => {
                event.stopPropagation();
                snoozeMutation.mutate(null);
              }}
            >
              {iconEl}
            </IconButton>
          );
        }

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
            className={cn(
              rowAction.destructive &&
                "text-destructive hover:text-destructive",
            )}
          >
            {iconEl}
          </IconButton>
        );
      })}
    </div>
  );
}
