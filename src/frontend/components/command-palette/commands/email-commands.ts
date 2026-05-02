import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { invalidateInboxQueries } from "@/features/email/mail/queries";
import { patchEmail, type EmailIdentifier } from "@/features/email/mail/mutations";
import type { EmailListItem, EmailListPage } from "@/features/email/mail/types";
import { isEmailListInfiniteData } from "@/features/email/mail/utils/email-list-cache";
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
import type { InfiniteData } from "@tanstack/react-query";
import { addHours, nextMonday, startOfTomorrow } from "date-fns";
import { toast } from "sonner";
import { paletteIcon } from "../registry/palette-icon";
import { registerCommands } from "../registry/registry";
import type {
  Command,
  CommandContext,
  CommandServices,
} from "../registry/types";

type PatchData = Parameters<typeof patchEmail>[1];

// Actions that remove the email from the current list view.
function removesFromList(data: PatchData): boolean {
  return Boolean(data.archived || data.trashed || data.spam || data.snoozedUntil);
}

function optimisticRemove(
  old: unknown,
  emailId: string,
): unknown {
  if (!isEmailListInfiniteData(old)) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      emails: page.emails.filter((e) => e.id !== emailId),
    })),
  };
}

async function performEmailAction(
  ctx: CommandContext,
  services: CommandServices,
  data: PatchData,
  label?: string,
) {
  if (!ctx.selectedEmailId) return;
  services.close();

  const emailId = ctx.selectedEmailId;

  // Resolve full email from cache
  let emailItem: EmailListItem | undefined;
  const caches = services.queryClient.getQueriesData<
    InfiniteData<EmailListPage>
  >({ queryKey: emailQueryKeys.all() });
  for (const [, cache] of caches) {
    for (const page of cache?.pages ?? []) {
      const found = page.emails.find((e) => e.id === emailId);
      if (found) { emailItem = found; break; }
    }
    if (emailItem) break;
  }

  if (!emailItem || !emailItem.mailboxId) return;

  const identifier: EmailIdentifier = {
    id: emailItem.id,
    providerMessageId: emailItem.providerMessageId,
    mailboxId: emailItem.mailboxId,
    labelIds: emailItem.labelIds,
  };

  // Optimistically remove from all list caches if this action hides the email.
  if (removesFromList(data)) {
    services.queryClient.setQueriesData(
      { queryKey: emailQueryKeys.all() },
      (old) => optimisticRemove(old, emailId),
    );
  }

  try {
    await patchEmail(identifier, data);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Action failed");
  }

  invalidateInboxQueries();
  void services.queryClient.invalidateQueries({
    queryKey: emailQueryKeys.detail(emailId),
  });

  if (label) toast(label);
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
    when: hasEmail,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { archived: true }),
  },
  {
    id: "email:move-to-inbox",
    label: "Move to inbox",
    icon: paletteIcon(TrayIcon),
    group: "email",
    keywords: ["unarchive", "inbox", "move"],
    when: hasEmail,
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
      performEmailAction(ctx, services, { trashed: true }, "Moved to trash"),
  },
  {
    id: "email:spam",
    label: "Mark as spam",
    icon: paletteIcon(WarningIcon),
    group: "email",
    keywords: ["spam", "junk"],
    when: hasEmail,
    perform: (ctx, services) =>
      performEmailAction(ctx, services, { spam: true }, "Marked as spam"),
  },
  {
    id: "email:mark-read",
    label: "Mark as read",
    icon: paletteIcon(EnvelopeOpenIcon),
    group: "email",
    shortcut: "U",
    keywords: ["read", "seen"],
    when: hasEmail,
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
    when: hasEmail,
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
    perform: (ctx, services) =>
      performEmailAction(
        ctx,
        services,
        { snoozedUntil: addHours(new Date(), 1).getTime() },
        "Snoozed for 1 hour",
      ),
  },
  {
    id: "email:snooze-tomorrow",
    label: "Snooze until tomorrow",
    icon: paletteIcon(ClockIcon),
    group: "email",
    keywords: ["snooze", "remind", "tomorrow"],
    when: hasEmail,
    perform: (ctx, services) =>
      performEmailAction(
        ctx,
        services,
        { snoozedUntil: startOfTomorrow().getTime() },
        "Snoozed until tomorrow",
      ),
  },
  {
    id: "email:snooze-next-week",
    label: "Snooze until next week",
    icon: paletteIcon(ClockIcon),
    group: "email",
    keywords: ["snooze", "remind", "next week"],
    when: hasEmail,
    perform: (ctx, services) =>
      performEmailAction(
        ctx,
        services,
        { snoozedUntil: nextMonday(new Date()).getTime() },
        "Snoozed until next week",
      ),
  },
];

registerCommands(emailCommands);
