import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArchiveIcon,
  CheckIcon,
  EnvelopeOpenIcon,
  EnvelopeSimpleIcon,
  StarIcon,
  XIcon,
} from "@phosphor-icons/react";

type EmailBulkToolbarProps = {
  count: number;
  allSelected: boolean;
  disabled?: boolean;
  onSelectAll: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onStarToggle: () => void;
  onDeselect: () => void;
};

export function EmailBulkToolbar({
  count,
  allSelected,
  disabled = false,
  onSelectAll,
  onArchive,
  onTrash,
  onMarkRead,
  onMarkUnread,
  onStarToggle,
  onDeselect,
}: EmailBulkToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-background/92 px-2.5 py-2 shadow-sm backdrop-blur-sm">
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectAll}
        className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors ${
          disabled
            ? "pointer-events-none opacity-50"
            : "hover:bg-muted/70 hover:text-foreground"
        }`}
        onKeyDown={(event) => {
          if (disabled) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectAll();
          }
        }}
        aria-disabled={disabled}
      >
        <Checkbox checked={allSelected} aria-hidden />
        <span>{allSelected ? "All visible" : "Select all"}</span>
      </div>
      <div className="rounded-lg bg-muted px-2 py-1 text-[11px] font-medium tracking-tight text-foreground">
        {count} selected
      </div>
      <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden />
      <Button
        size="sm"
        variant="ghost"
        className="rounded-lg text-[11px]"
        onClick={onArchive}
        disabled={disabled}
      >
        <ArchiveIcon className="size-3.5" />
        Archive
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-lg text-[11px]"
        onClick={onMarkRead}
        disabled={disabled}
      >
        <EnvelopeOpenIcon className="size-3.5" />
        Read
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-lg text-[11px]"
        onClick={onMarkUnread}
        disabled={disabled}
      >
        <EnvelopeSimpleIcon className="size-3.5" />
        Unread
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-lg text-[11px]"
        onClick={onStarToggle}
        disabled={disabled}
      >
        <StarIcon className="size-3.5" />
        Star
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-lg text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onTrash}
        disabled={disabled}
      >
        <XIcon className="size-3.5" />
        Trash
      </Button>
      <span className="ml-auto" />
      <Button
        size="sm"
        variant="ghost"
        className="rounded-lg text-[11px] text-muted-foreground"
        onClick={onDeselect}
        disabled={disabled}
      >
        <CheckIcon className="size-3.5" />
        Done
      </Button>
    </div>
  );
}
