import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { ReactNode } from "react";
import type { EmailListItem } from "../types";

type EmailContextMenuProps = {
  children: ReactNode;
  targetEmail: EmailListItem;
  onArchive: () => void;
  onTrash: () => void;
  onSpam: () => void;
  onSetRead: (isRead: boolean) => void;
  onSetStarred: (starred: boolean) => void;
};

export function EmailContextMenu({
  children,
  targetEmail,
  onArchive,
  onTrash,
  onSpam,
  onSetRead,
  onSetStarred,
}: EmailContextMenuProps) {
  const isRead = targetEmail.isRead;
  const isStarred = targetEmail.labelIds.includes("STARRED");

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block w-full">
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44 rounded-md">
        <ContextMenuItem onSelect={onArchive}>Archive</ContextMenuItem>
        <ContextMenuItem onSelect={onTrash}>Move to trash</ContextMenuItem>
        <ContextMenuItem onSelect={onSpam}>Move to spam</ContextMenuItem>
        <ContextMenuItem onSelect={() => onSetRead(!isRead)}>
          {isRead ? "Mark as unread" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onSetStarred(!isStarred)}>
          {isStarred ? "Unstar" : "Star"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
