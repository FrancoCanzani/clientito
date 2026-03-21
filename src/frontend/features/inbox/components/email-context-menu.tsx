import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ArchiveIcon,
  CheckSquareIcon,
  EnvelopeOpenIcon,
  EnvelopeSimpleIcon,
  SquaresFourIcon,
  StarIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { EmailListItem } from "../types";

type EmailContextMenuProps = {
  children: ReactNode;
  email: EmailListItem;
  selected: boolean;
  targetEmails: EmailListItem[];
  onArchive: () => void;
  onTrash: () => void;
  onSpam: () => void;
  onSetRead: (isRead: boolean) => void;
  onSetStarred: (starred: boolean) => void;
  onToggleSelect: () => void;
  onSelectAll: () => void;
};

export function EmailContextMenu({
  children,
  selected,
  targetEmails,
  onArchive,
  onTrash,
  onSpam,
  onSetRead,
  onSetStarred,
  onToggleSelect,
  onSelectAll,
}: EmailContextMenuProps) {
  const allRead = targetEmails.every((email) => email.isRead);
  const allStarred = targetEmails.every((email) =>
    email.labelIds.includes("STARRED"),
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={onArchive}
          className="flex items-center justify-start gap-1.5"
        >
          <ArchiveIcon className="size-3.5" />
          Archive
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onTrash}
          variant="destructive"
          className="flex items-center justify-start gap-1.5"
        >
          <TrashIcon className="size-3.5" />
          Move to trash
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onSpam}
          className="flex items-center justify-start gap-1.5"
        >
          <WarningIcon className="size-3.5" />
          Move to spam
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onSetRead(!allRead)}
          className="flex items-center justify-start gap-1.5"
        >
          {allRead ? (
            <EnvelopeSimpleIcon className="size-3.5" />
          ) : (
            <EnvelopeOpenIcon className="size-3.5" />
          )}
          {allRead ? "Mark as unread" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onSetStarred(!allStarred)}
          className="flex items-center justify-start gap-1.5"
        >
          <StarIcon
            className="size-3.5"
            weight={allStarred ? "fill" : "regular"}
          />
          {allStarred ? "Unstar" : "Star"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem
          checked={selected}
          onSelect={onToggleSelect}
          className="flex items-center justify-start gap-1.5"
        >
          <CheckSquareIcon className="size-3.5" />
          {selected ? "Deselect" : "Select"}
        </ContextMenuCheckboxItem>
        <ContextMenuItem
          onSelect={onSelectAll}
          className="flex items-center justify-start gap-1.5"
        >
          <SquaresFourIcon className="size-3.5" />
          Select all
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
