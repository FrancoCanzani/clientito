import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
      <ContextMenuContent className="min-w-44 rounded-md">
        <ContextMenuItem onSelect={onArchive}>Archive</ContextMenuItem>
        <ContextMenuItem onSelect={onTrash}>Move to trash</ContextMenuItem>
        <ContextMenuItem onSelect={onSpam}>Move to spam</ContextMenuItem>
        <ContextMenuItem onSelect={() => onSetRead(!allRead)}>
          {allRead ? "Mark as unread" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onSetStarred(!allStarred)}>
          {allStarred ? "Unstar" : "Star"}
        </ContextMenuItem>
        <ContextMenuSeparator className="mx-1 my-1.5" />
        <ContextMenuItem onSelect={onToggleSelect}>
          {selected ? "Deselect" : "Select"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onSelectAll}>Select all</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
