import type { MailAction } from "@/features/email/mail/hooks/use-mail-actions";
import type { EmailListItem } from "@/features/email/mail/types";
import {
  CheckIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  type Icon,
} from "@phosphor-icons/react";

export type RowAction = {
  key: string;
  label: string;
  shortcut?: string;
  icon: Icon;
  iconWeight?: "fill" | "regular";
  action: MailAction;
};

export function getRowActions(
  view: string,
  email: EmailListItem,
): RowAction[] {
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

  const done: RowAction = {
    key: "done",
    label: "Done",
    shortcut: "E",
    icon: CheckIcon,
    action: view === "archived" || view === "trash" ? "move-to-inbox" : "archive",
  };

  return [done, markRead];
}
