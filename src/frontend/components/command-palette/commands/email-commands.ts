import { patchEmail } from "@/features/email/inbox/mutations";
import {
  CheckIcon,
  ClockIcon,
  EnvelopeOpenIcon,
  EnvelopeSimpleIcon,
  StarIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { addHours, nextMonday, startOfTomorrow } from "date-fns";
import { toast } from "sonner";
import { paletteIcon } from "../registry/palette-icon";
import { registerCommands } from "../registry/registry";
import type {
  Command,
  CommandContext,
  CommandServices,
} from "../registry/types";

async function performEmailAction(
  ctx: CommandContext,
  services: CommandServices,
  data: Record<string, unknown>,
) {
  if (!ctx.selectedEmailId) return;
  try {
    await patchEmail(ctx.selectedEmailId, data as Record<string, boolean>);
    void services.queryClient.invalidateQueries({
      queryKey: ["email-detail", ctx.selectedEmailId],
    });
    void services.queryClient.invalidateQueries({
      queryKey: ["emails"],
    });
  } catch (error) {
    void services.queryClient.invalidateQueries({
      queryKey: ["emails"],
    });
    toast.error(error instanceof Error ? error.message : "Action failed");
  }
}

const hasEmail = (ctx: CommandContext) => ctx.selectedEmailId !== null;

const emailCommands: Command[] = [
  {
    id: "email:done",
    label: "Mark as done",
    icon: paletteIcon(CheckIcon),
    group: "email",
    shortcut: "E",
    keywords: ["done", "archive", "remove"],
    when: (ctx) => hasEmail(ctx) && ctx.selectedEmailIsArchived !== true,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { archived: true }),
  },
  {
    id: "email:move-to-inbox",
    label: "Move to inbox",
    icon: paletteIcon(TrayIcon),
    group: "email",
    keywords: ["unarchive", "inbox", "move"],
    when: (ctx) => hasEmail(ctx) && ctx.selectedEmailIsArchived === true,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { archived: false }),
  },
  {
    id: "email:trash",
    label: "Move to trash",
    icon: paletteIcon(TrashIcon),
    group: "email",
    shortcut: "#",
    keywords: ["trash", "delete", "remove"],
    when: hasEmail,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { trashed: true }),
  },
  {
    id: "email:spam",
    label: "Mark as spam",
    icon: paletteIcon(WarningIcon),
    group: "email",
    keywords: ["spam", "junk"],
    when: hasEmail,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { spam: true }),
  },
  {
    id: "email:mark-read",
    label: "Mark as read",
    icon: paletteIcon(EnvelopeOpenIcon),
    group: "email",
    shortcut: "U",
    keywords: ["read", "seen"],
    when: (ctx) => hasEmail(ctx) && ctx.selectedEmailIsRead !== true,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { isRead: true }),
  },
  {
    id: "email:mark-unread",
    label: "Mark as unread",
    icon: paletteIcon(EnvelopeSimpleIcon),
    group: "email",
    shortcut: "U",
    keywords: ["unread", "unseen"],
    when: (ctx) => hasEmail(ctx) && ctx.selectedEmailIsRead !== false,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { isRead: false }),
  },
  {
    id: "email:star",
    label: "Star email",
    icon: paletteIcon(StarIcon),
    group: "email",
    shortcut: "S",
    keywords: ["star", "favorite", "important"],
    when: hasEmail,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { starred: true }),
  },
  {
    id: "email:unstar",
    label: "Unstar email",
    icon: paletteIcon(StarIcon),
    group: "email",
    keywords: ["unstar", "unfavorite"],
    when: hasEmail,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { starred: false }),
  },
  {
    id: "email:snooze-1h",
    label: "Snooze for 1 hour",
    icon: paletteIcon(ClockIcon),
    group: "email",
    keywords: ["snooze", "remind", "later"],
    when: hasEmail,
    perform: (ctx, services) => {
      performEmailAction(ctx, services, {
        snoozedUntil: addHours(new Date(), 1).getTime(),
      });
      services.close();
    },
  },
  {
    id: "email:snooze-tomorrow",
    label: "Snooze until tomorrow",
    icon: paletteIcon(ClockIcon),
    group: "email",
    keywords: ["snooze", "remind", "tomorrow"],
    when: hasEmail,
    perform: (ctx, services) => {
      performEmailAction(ctx, services, {
        snoozedUntil: startOfTomorrow().getTime(),
      });
      services.close();
    },
  },
  {
    id: "email:snooze-next-week",
    label: "Snooze until next week",
    icon: paletteIcon(ClockIcon),
    group: "email",
    keywords: ["snooze", "remind", "next week"],
    when: hasEmail,
    perform: (ctx, services) => {
      performEmailAction(ctx, services, {
        snoozedUntil: nextMonday(new Date()).getTime(),
      });
      services.close();
    },
  },
];

registerCommands(emailCommands);
