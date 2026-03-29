import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ArchiveIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  StarIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
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
        <ContextMenuItem onSelect={onArchive}>
          <ArchiveIcon className="size-4 text-muted-foreground" />
          Archive
        </ContextMenuItem>
        <ContextMenuItem onSelect={onTrash}>
          <TrashIcon className="size-4 text-muted-foreground" />
          Move to trash
        </ContextMenuItem>
        <ContextMenuItem onSelect={onSpam}>
          <WarningIcon className="size-4 text-muted-foreground" />
          Move to spam
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onSetRead(!isRead)}>
          {isRead ? (
            <EnvelopeSimpleIcon className="size-4 text-muted-foreground" />
          ) : (
            <EnvelopeSimpleOpenIcon className="size-4 text-muted-foreground" />
          )}
          {isRead ? "Mark as unread" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onSetStarred(!isStarred)}>
          <StarIcon
            className="size-4 text-muted-foreground"
            weight={isStarred ? "fill" : "regular"}
          />
          {isStarred ? "Unstar" : "Star"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
