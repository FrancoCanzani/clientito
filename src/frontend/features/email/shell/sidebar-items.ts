import {
 ArchiveIcon,
 BellSlashIcon,
 FileDashedIcon,
 MagnifyingGlassIcon,
 PaperPlaneTiltIcon,
 StarIcon,
 TrashIcon,
 TrayIcon,
 WarningIcon,
 type Icon,
} from "@phosphor-icons/react";

export type SidebarRouteState = {
 routeIds: string[];
 folder: string | null;
 label: string | null;
};

export type MailSidebarItem = {
 id: string;
 label: string;
 icon: Icon;
 shortcutId?: string;
 to: string;
 params: (mailboxId: number) => Record<string, unknown>;
 match: (state: SidebarRouteState) => boolean;
};

function isInboxRoot(state: SidebarRouteState): boolean {
 if (state.label != null) return false;
 return state.routeIds.some(
 (id) =>
 id === "/_dashboard/$mailboxId/inbox/" ||
 id === "/_dashboard/$mailboxId/inbox/email/$emailId",
 );
}

function hasRouteId(state: SidebarRouteState, routeId: string): boolean {
 return state.routeIds.includes(routeId);
}

export const MAIL_SIDEBAR_ITEMS: readonly MailSidebarItem[] = [
 {
 id: "inbox",
 label: "Inbox",
 icon: TrayIcon,
 shortcutId: "nav:inbox",
 to: "/$mailboxId/inbox",
 params: (mailboxId) => ({ mailboxId }),
 match: isInboxRoot,
 },
 {
 id: "search",
 label: "Search",
 icon: MagnifyingGlassIcon,
 shortcutId: "nav:search",
 to: "/$mailboxId/inbox/search",
 params: (mailboxId) => ({ mailboxId }),
 match: (state) =>
 hasRouteId(state, "/_dashboard/$mailboxId/inbox/search"),
 },
 {
 id: "starred",
 label: "Starred",
 icon: StarIcon,
 shortcutId: "nav:starred",
 to: "/$mailboxId/$folder",
 params: (mailboxId) => ({ mailboxId, folder: "starred" }),
 match: (state) => state.folder === "starred",
 },
 {
 id: "archived",
 label: "Done",
 icon: ArchiveIcon,
 shortcutId: "nav:archived",
 to: "/$mailboxId/$folder",
 params: (mailboxId) => ({ mailboxId, folder: "archived" }),
 match: (state) => state.folder === "archived",
 },
 {
 id: "sent",
 label: "Sent",
 icon: PaperPlaneTiltIcon,
 shortcutId: "nav:sent",
 to: "/$mailboxId/$folder",
 params: (mailboxId) => ({ mailboxId, folder: "sent" }),
 match: (state) => state.folder === "sent",
 },
 {
 id: "drafts",
 label: "Drafts",
 icon: FileDashedIcon,
 shortcutId: "nav:drafts",
 to: "/$mailboxId/inbox/drafts",
 params: (mailboxId) => ({ mailboxId }),
 match: (state) =>
 hasRouteId(state, "/_dashboard/$mailboxId/inbox/drafts"),
 },
 {
 id: "spam",
 label: "Spam",
 icon: WarningIcon,
 shortcutId: "nav:spam",
 to: "/$mailboxId/$folder",
 params: (mailboxId) => ({ mailboxId, folder: "spam" }),
 match: (state) => state.folder === "spam",
 },
 {
 id: "trash",
 label: "Trash",
 icon: TrashIcon,
 shortcutId: "nav:trash",
 to: "/$mailboxId/$folder",
 params: (mailboxId) => ({ mailboxId, folder: "trash" }),
 match: (state) => state.folder === "trash",
 },
 {
 id: "subscriptions",
 label: "Subscriptions",
 icon: BellSlashIcon,
 shortcutId: "nav:subscriptions",
 to: "/$mailboxId/subscriptions",
 params: (mailboxId) => ({ mailboxId }),
 match: (state) =>
 hasRouteId(state, "/_dashboard/$mailboxId/subscriptions"),
 },
];

export function findActiveMailItem(
 state: SidebarRouteState,
): MailSidebarItem | undefined {
 return MAIL_SIDEBAR_ITEMS.find((item) => item.match(state));
}
