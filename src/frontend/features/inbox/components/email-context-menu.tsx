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

export function EmailContextMenu({
  children,
  targetEmail,
}: {
  children: ReactNode;
  targetEmail: EmailListItem;
}) {
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
          <ArchiveIcon className="size-3.5" />
          Archive
        </ContextMenuItem>

        <ContextMenuItem
          onSelect={() => executeEmailAction("spam", [targetEmail.id])}
        >
          <WarningIcon className="size-3.5" />
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
            <EnvelopeSimpleIcon className="size-3.5" />
          ) : (
            <EnvelopeSimpleOpenIcon className="size-3.5" />
          )}
          {isRead ? "Mark as unread" : "Mark as read"}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            executeEmailAction(isStarred ? "unstar" : "star", [targetEmail.id])
          }
        >
          <StarIcon
            className="size-3.5"
            weight={isStarred ? "fill" : "regular"}
          />
          {isStarred ? "Unstar" : "Star"}
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onSelect={() => executeEmailAction("trash", [targetEmail.id])}
        >
          <TrashIcon className="size-3.5" />
          Move to trash
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
