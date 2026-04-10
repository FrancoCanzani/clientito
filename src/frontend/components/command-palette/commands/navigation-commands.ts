import {
  CheckIcon,
  FileDashedIcon,
  FlagIcon,
  FunnelIcon,
  GearIcon,
  MagnifyingGlassIcon,
  NewspaperIcon,
  PaperPlaneTiltIcon,
  StarIcon,
  TrashIcon,
  TrayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { paletteIcon } from "../registry/palette-icon";
import { registerCommands } from "../registry/registry";
import type { Command } from "../registry/types";

type FolderNavCommand = {
  id: string;
  label: string;
  icon: ReturnType<typeof paletteIcon>;
  keywords?: string[];
  folder?: string;
  path?: string;
};

function makeNavCommand({
  id,
  label,
  icon,
  keywords,
  folder,
  path,
}: FolderNavCommand): Command {
  return {
    id,
    label,
    icon,
    group: "navigation",
    keywords,
    when: (ctx) => {
      if (ctx.defaultMailboxId == null) return false;
      if (folder) return ctx.currentView !== folder;
      return true;
    },
    perform: (ctx, services) => {
      const mailboxId = ctx.defaultMailboxId;
      if (mailboxId == null) {
        services.navigate({ to: "/get-started" });
        services.close();
        return;
      }
      if (path) {
        services.navigate({
          to: path as never,
          params: { mailboxId } as never,
        });
      } else if (folder) {
        services.navigate({
          to: "/$mailboxId/$folder",
          params: { mailboxId, folder } as never,
        });
      }
      services.close();
    },
  };
}

// Order mirrors the sidebar exactly
const navigationCommands: Command[] = [
  makeNavCommand({
    id: "nav:inbox",
    label: "Inbox",
    icon: paletteIcon(TrayIcon),
    keywords: ["inbox", "home"],
    path: "/$mailboxId/inbox",
  }),
  makeNavCommand({
    id: "nav:important",
    label: "Important",
    icon: paletteIcon(FlagIcon),
    keywords: ["important", "flagged"],
    folder: "important",
  }),
  makeNavCommand({
    id: "nav:starred",
    label: "Starred",
    icon: paletteIcon(StarIcon),
    keywords: ["starred", "favorites"],
    folder: "starred",
  }),
  makeNavCommand({
    id: "nav:sent",
    label: "Sent",
    icon: paletteIcon(PaperPlaneTiltIcon),
    keywords: ["sent", "outbox"],
    folder: "sent",
  }),
  makeNavCommand({
    id: "nav:done",
    label: "Done",
    icon: paletteIcon(CheckIcon),
    keywords: ["done", "archive", "archived"],
    folder: "archived",
  }),
  makeNavCommand({
    id: "nav:spam",
    label: "Spam",
    icon: paletteIcon(WarningCircleIcon),
    keywords: ["spam", "junk"],
    folder: "spam",
  }),
  makeNavCommand({
    id: "nav:trash",
    label: "Trash",
    icon: paletteIcon(TrashIcon),
    keywords: ["trash", "deleted"],
    folder: "trash",
  }),
  makeNavCommand({
    id: "nav:drafts",
    label: "Drafts",
    icon: paletteIcon(FileDashedIcon),
    keywords: ["drafts", "unsent"],
    path: "/$mailboxId/inbox/drafts",
  }),
  makeNavCommand({
    id: "nav:search",
    label: "Search emails",
    icon: paletteIcon(MagnifyingGlassIcon),
    keywords: ["search", "find", "lookup"],
    path: "/$mailboxId/inbox/search",
  }),
  makeNavCommand({
    id: "nav:subscriptions",
    label: "Subscriptions",
    icon: paletteIcon(NewspaperIcon),
    keywords: ["subscriptions", "newsletters", "unsubscribe"],
    path: "/$mailboxId/inbox/subscriptions",
  }),
  makeNavCommand({
    id: "nav:filters",
    label: "Filters",
    icon: paletteIcon(FunnelIcon),
    keywords: ["filters", "rules"],
    path: "/$mailboxId/inbox/filters",
  }),
  {
    id: "nav:settings",
    label: "Settings",
    icon: paletteIcon(GearIcon),
    group: "navigation",
    keywords: ["settings", "preferences", "account"],
    perform: (_ctx, services) => {
      services.navigate({ to: "/settings" });
      services.close();
    },
  },
];

registerCommands(navigationCommands);
