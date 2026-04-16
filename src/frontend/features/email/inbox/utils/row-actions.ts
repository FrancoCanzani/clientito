import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { EmailListItem } from "@/features/email/inbox/types";
import {
  CheckIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  ShieldCheckIcon,
  StarIcon,
  TrashIcon,
  TrayArrowDownIcon,
  type Icon,
} from "@phosphor-icons/react";

export type RowActionKind = "default" | "snooze" | "unsnooze";

export type RowAction = {
  key: string;
  label: string;
  shortcut?: string;
  icon: Icon;
  iconWeight?: "fill" | "regular";
  action: EmailInboxAction;
  kind?: RowActionKind;
  destructive?: boolean;
  confirm?: {
    title: string;
    description: string;
    confirmLabel: string;
  };
};

export function getRowActions(
  view: string,
  email: EmailListItem,
): RowAction[] {
  const isStarred = email.labelIds.includes("STARRED");
  const markRead: RowAction = email.isRead
    ? {
        key: "mark-unread",
        label: "Mark as unread",
        shortcut: "U",
        icon: EnvelopeSimpleIcon,
        action: "mark-unread",
      }
    : {
        key: "mark-read",
        label: "Mark as read",
        shortcut: "U",
        icon: EnvelopeSimpleOpenIcon,
        action: "mark-read",
      };

  const star: RowAction = {
    key: isStarred ? "unstar" : "star",
    label: isStarred ? "Unstar" : "Star",
    shortcut: "S",
    icon: StarIcon,
    iconWeight: isStarred ? "fill" : "regular",
    action: isStarred ? "unstar" : "star",
  };

  const snooze: RowAction = {
    key: "snooze",
    label: "Snooze",
    icon: ClockIcon,
    action: "mark-read",
    kind: "snooze",
  };

  const unsnooze: RowAction = {
    key: "unsnooze",
    label: "Unsnooze",
    icon: ClockIcon,
    iconWeight: "fill",
    action: "mark-read",
    kind: "unsnooze",
  };

  const archive: RowAction = {
    key: "archive",
    label: "Archive",
    shortcut: "E",
    icon: CheckIcon,
    action: "archive",
  };

  const trash: RowAction = {
    key: "trash",
    label: "Delete",
    shortcut: "#",
    icon: TrashIcon,
    action: "trash",
  };

  const moveToInbox: RowAction = {
    key: "move-to-inbox",
    label: "Move to inbox",
    shortcut: "E",
    icon: TrayArrowDownIcon,
    action: "move-to-inbox",
  };

  const deleteForever: RowAction = {
    key: "delete-forever",
    label: "Delete forever",
    shortcut: "#",
    icon: TrashIcon,
    action: "delete-forever",
    destructive: true,
    confirm: {
      title: "Delete this email forever?",
      description:
        "This permanently removes the message from Gmail. This action cannot be undone.",
      confirmLabel: "Delete forever",
    },
  };

  const notSpam: RowAction = {
    key: "not-spam",
    label: "Not spam",
    icon: ShieldCheckIcon,
    action: "not-spam",
  };

  switch (view) {
    case "archived":
      return [moveToInbox, star, markRead, trash];
    case "trash":
      return [moveToInbox, markRead, deleteForever];
    case "spam":
      return [notSpam, trash];
    case "sent":
      return [star, markRead, trash];
    case "snoozed":
      return [archive, unsnooze, markRead, trash];
    case "starred":
    case "important":
    case "inbox":
    default:
      return [archive, star, snooze, markRead, trash];
  }
}
