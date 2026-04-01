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
import { useEmail } from "../context/email-context";
import type { EmailListItem } from "../types";

type EmailContextMenuProps = {
  children: ReactNode;
  targetEmail: EmailListItem;
};

export function EmailContextMenu({
  children,
  targetEmail,
}: EmailContextMenuProps) {
  const { executeEmailAction } = useEmail();
  const isRead = targetEmail.isRead;
  const isStarred = targetEmail.labelIds.includes("STARRED");

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="block w-full">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => executeEmailAction("archive", [targetEmail.id])}
        >
          <ArchiveIcon className="size-3.5 text-muted-foreground" />
          Archive
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => executeEmailAction("trash", [targetEmail.id])}
        >
          <TrashIcon className="size-3.5 text-muted-foreground" />
          Move to trash
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => executeEmailAction("spam", [targetEmail.id])}
        >
          <WarningIcon className="size-3.5 text-muted-foreground" />
          Move to spam
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            executeEmailAction(isRead ? "mark-unread" : "mark-read", [
              targetEmail.id,
            ])
          }
        >
          {isRead ? (
            <EnvelopeSimpleIcon className="size-3.5 text-muted-foreground" />
          ) : (
            <EnvelopeSimpleOpenIcon className="size-3.5 text-muted-foreground" />
          )}
          {isRead ? "Mark as unread" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            executeEmailAction(isStarred ? "unstar" : "star", [targetEmail.id])
          }
        >
          <StarIcon
            className="size-3.5 text-muted-foreground"
            weight={isStarred ? "fill" : "regular"}
          />
          {isStarred ? "Unstar" : "Star"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
