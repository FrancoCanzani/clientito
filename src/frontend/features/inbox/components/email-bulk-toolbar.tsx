import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useId } from "react";

type EmailBulkToolbarProps = {
  count: number;
  allSelected: boolean;
  disabled?: boolean;
  onToggleAll: (checked: boolean) => void;
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
  onToggleAll,
  onArchive,
  onTrash,
  onMarkRead,
  onMarkUnread,
  onStarToggle,
  onDeselect,
}: EmailBulkToolbarProps) {
  const selectAllId = useId();

  return (
    <div className="sticky top-11 z-20 -mx-1 flex flex-wrap items-center gap-1.5">
      <div className={"text-xs flex items-center justify-start gap-1"}>
        <Checkbox
          id={selectAllId}
          checked={allSelected}
          disabled={disabled}
          onCheckedChange={(checked) => onToggleAll(checked === true)}
          aria-label={
            allSelected
              ? "Deselect all visible emails"
              : "Select all visible emails"
          }
        />
        <label
          htmlFor={selectAllId}
          className={`transition-colors ${disabled ? "" : "cursor-pointer hover:text-foreground"}`}
        >
          {allSelected ? "All visible" : "Select all"}
        </label>
      </div>
      <div className="text-muted-foreground text-xs">{count} selected</div>
      <Button size="xs" variant="ghost" onClick={onArchive} disabled={disabled}>
        Archive
      </Button>
      <Button
        size="xs"
        variant="ghost"
        onClick={onMarkRead}
        disabled={disabled}
      >
        Read
      </Button>
      <Button
        size="xs"
        variant="ghost"
        onClick={onMarkUnread}
        disabled={disabled}
      >
        Unread
      </Button>
      <Button
        size="xs"
        variant="ghost"
        onClick={onStarToggle}
        disabled={disabled}
      >
        Star
      </Button>
      <Button
        size="xs"
        variant="destructive"
        onClick={onTrash}
        disabled={disabled}
      >
        Trash
      </Button>
      <span className="ml-auto" />
      <Button
        size="xs"
        variant="ghost"
        onClick={onDeselect}
        disabled={disabled}
      >
        Done
      </Button>
    </div>
  );
}
