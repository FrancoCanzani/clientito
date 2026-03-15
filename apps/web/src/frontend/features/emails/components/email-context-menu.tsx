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
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={onArchive}
          className="flex items-center justify-start gap-2"
        >
          <ArchiveIcon className="size-4" />
          Archive
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onTrash}
          variant="destructive"
          className="flex items-center justify-start gap-2"
        >
          <TrashIcon className="size-4" />
          Move to trash
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onSpam}
          className="flex items-center justify-start gap-2"
        >
          <WarningIcon className="size-4" />
          Move to spam
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onSetRead(!allRead)}
          className="flex items-center justify-start gap-2"
        >
          {allRead ? (
            <EnvelopeSimpleIcon className="size-4" />
          ) : (
            <EnvelopeOpenIcon className="size-4" />
          )}
          {allRead ? "Mark as unread" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onSetStarred(!allStarred)}
          className="flex items-center justify-start gap-2"
        >
          <StarIcon
            className="size-4"
            weight={allStarred ? "fill" : "regular"}
          />
          {allStarred ? "Unstar" : "Star"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem
          checked={selected}
          onSelect={onToggleSelect}
          className="flex items-center justify-start gap-2"
        >
          <CheckSquareIcon className="size-4" />
          {selected ? "Deselect" : "Select"}
        </ContextMenuCheckboxItem>
        <ContextMenuItem
          onSelect={onSelectAll}
          className="flex items-center justify-start gap-2"
        >
          <SquaresFourIcon className="size-4" />
          Select all
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
