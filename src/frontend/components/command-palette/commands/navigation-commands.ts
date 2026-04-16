import {
  BookOpenIcon,
  CheckIcon,
  FileDashedIcon,
  FlagIcon,
  GearIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  StarIcon,
  TrashIcon,
  TrayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type {
  EmailFolderView,
  InboxLabelView,
} from "@/features/email/inbox/utils/inbox-filters";
import { paletteIcon } from "../registry/palette-icon";
import { registerCommands } from "../registry/registry";
import type { Command, CommandServices } from "../registry/types";

type NavCommandConfig = {
  id: string;
  label: string;
  icon: ReturnType<typeof paletteIcon>;
  keywords?: string[];
  when?: Command["when"];
  perform: (mailboxId: number, services: CommandServices) => void;
};

function makeNavCommand({
  id,
  label,
  icon,
  keywords,
  when,
  perform,
}: NavCommandConfig): Command {
  return {
    id,
    label,
    icon,
    group: "navigation",
    keywords,
    when: (ctx) => ctx.defaultMailboxId != null && (!when || when(ctx)),
    perform: (ctx, services) => {
      const mailboxId = ctx.defaultMailboxId;
      if (mailboxId == null) {
        services.navigate({ to: "/login" });
        services.close();
        return;
      }
      perform(mailboxId, services);
      services.close();
    },
  };
}

function navigateToInbox(mailboxId: number, services: CommandServices) {
  services.navigate({
    to: "/$mailboxId/inbox",
    params: { mailboxId },
  });
}

function navigateToFolder(
  mailboxId: number,
  folder: EmailFolderView,
  services: CommandServices,
) {
  services.navigate({
    to: "/$mailboxId/$folder",
    params: { mailboxId, folder },
  });
}

function navigateToLabel(
  mailboxId: number,
  label: InboxLabelView,
  services: CommandServices,
) {
  services.navigate({
    to: "/$mailboxId/inbox/labels/$label",
    params: { mailboxId, label },
  });
}

function navigateToMailboxPath(
  mailboxId: number,
  to:
    | "/$mailboxId/inbox/drafts"
    | "/$mailboxId/inbox/search",
  services: CommandServices,
) {
  services.navigate({
    to,
    params: { mailboxId },
  });
}

// Order mirrors the sidebar exactly
const navigationCommands: Command[] = [
  makeNavCommand({
    id: "nav:inbox",
    label: "Inbox",
    icon: paletteIcon(TrayIcon),
    keywords: ["inbox", "home"],
    when: (ctx) => ctx.currentView !== "inbox",
    perform: (mailboxId, services) => navigateToInbox(mailboxId, services),
  }),
  makeNavCommand({
    id: "nav:important",
    label: "Important",
    icon: paletteIcon(FlagIcon),
    keywords: ["important", "flagged"],
    when: (ctx) => ctx.currentView !== "important",
    perform: (mailboxId, services) =>
      navigateToLabel(mailboxId, "important", services),
  }),
  makeNavCommand({
    id: "nav:starred",
    label: "Starred",
    icon: paletteIcon(StarIcon),
    keywords: ["starred", "favorites"],
    when: (ctx) => ctx.currentView !== "starred",
    perform: (mailboxId, services) =>
      navigateToFolder(mailboxId, "starred", services),
  }),
  makeNavCommand({
    id: "nav:sent",
    label: "Sent",
    icon: paletteIcon(PaperPlaneTiltIcon),
    keywords: ["sent", "outbox"],
    when: (ctx) => ctx.currentView !== "sent",
    perform: (mailboxId, services) => navigateToFolder(mailboxId, "sent", services),
  }),
  makeNavCommand({
    id: "nav:done",
    label: "Done",
    icon: paletteIcon(CheckIcon),
    keywords: ["done", "archive", "archived"],
    when: (ctx) => ctx.currentView !== "archived",
    perform: (mailboxId, services) =>
      navigateToFolder(mailboxId, "archived", services),
  }),
  makeNavCommand({
    id: "nav:spam",
    label: "Spam",
    icon: paletteIcon(WarningCircleIcon),
    keywords: ["spam", "junk"],
    when: (ctx) => ctx.currentView !== "spam",
    perform: (mailboxId, services) => navigateToFolder(mailboxId, "spam", services),
  }),
  makeNavCommand({
    id: "nav:trash",
    label: "Trash",
    icon: paletteIcon(TrashIcon),
    keywords: ["trash", "deleted"],
    when: (ctx) => ctx.currentView !== "trash",
    perform: (mailboxId, services) => navigateToFolder(mailboxId, "trash", services),
  }),
  makeNavCommand({
    id: "nav:drafts",
    label: "Drafts",
    icon: paletteIcon(FileDashedIcon),
    keywords: ["drafts", "unsent"],
    perform: (mailboxId, services) =>
      navigateToMailboxPath(mailboxId, "/$mailboxId/inbox/drafts", services),
  }),
  makeNavCommand({
    id: "nav:search",
    label: "Search emails",
    icon: paletteIcon(MagnifyingGlassIcon),
    keywords: ["search", "find", "lookup"],
    perform: (mailboxId, services) =>
      navigateToMailboxPath(mailboxId, "/$mailboxId/inbox/search", services),
  }),
  {
    id: "nav:docs",
    label: "Docs",
    icon: paletteIcon(BookOpenIcon),
    group: "navigation",
    keywords: ["docs", "documentation", "help", "manual"],
    when: (ctx) =>
      ctx.currentRouteId !== "/docs/" && ctx.currentRouteId !== "/docs/$slug",
    perform: (_ctx, services) => {
      services.navigate({ to: "/docs" });
      services.close();
    },
  },
  {
    id: "nav:settings",
    label: "Settings",
    icon: paletteIcon(GearIcon),
    group: "navigation",
    keywords: ["settings", "preferences", "account"],
    perform: (ctx, services) => {
      const mailboxId = ctx.defaultMailboxId;
      if (mailboxId != null) {
        services.navigate({ to: "/$mailboxId/settings", params: { mailboxId } });
      } else {
        services.navigate({ to: "/login" });
      }
      services.close();
    },
  },
];

registerCommands(navigationCommands);
