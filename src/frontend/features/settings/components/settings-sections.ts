export type SettingsSectionTo =
 | "/$mailboxId/settings/account"
 | "/$mailboxId/settings/appearance"
 | "/$mailboxId/settings/mailbox"
 | "/$mailboxId/settings/signatures"
 | "/$mailboxId/settings/templates"
 | "/$mailboxId/settings/labels"
 | "/$mailboxId/settings/ai"
 | "/$mailboxId/settings/danger";

export type SettingsSection = {
 to: SettingsSectionTo;
 routeId: string;
 group: SettingsGroup;
 title: string;
 description: string;
 destructive?: boolean;
};

export type SettingsGroup = "General" | "Mail" | "Safety";

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
 {
 to: "/$mailboxId/settings/account",
 routeId: "/_dashboard/$mailboxId/settings/account",
 group: "General",
 title: "Account",
 description: "Basic profile details for your Duomo account.",
 },
 {
 to: "/$mailboxId/settings/appearance",
 routeId: "/_dashboard/$mailboxId/settings/appearance",
 group: "General",
 title: "Appearance",
 description: "Pick how the interface is rendered.",
 },
 {
 to: "/$mailboxId/settings/mailbox",
 routeId: "/_dashboard/$mailboxId/settings/mailbox",
 group: "Mail",
 title: "Mailbox",
 description: "Status and local cache controls for the current account.",
 },
 {
 to: "/$mailboxId/settings/signatures",
 routeId: "/_dashboard/$mailboxId/settings/signatures",
 group: "Mail",
 title: "Signatures",
 description:
 "Create rich email signatures and choose the default for this account.",
 },
 {
 to: "/$mailboxId/settings/templates",
 routeId: "/_dashboard/$mailboxId/settings/templates",
 group: "Mail",
 title: "Templates",
 description: "Save reusable subject and body snippets for compose.",
 },
 {
 to: "/$mailboxId/settings/labels",
 routeId: "/_dashboard/$mailboxId/settings/labels",
 group: "Mail",
 title: "Labels",
 description: "Manage Gmail labels for this mailbox.",
 },
 {
 to: "/$mailboxId/settings/ai",
 routeId: "/_dashboard/$mailboxId/settings/ai",
 group: "Mail",
 title: "AI",
 description: "Control AI-powered features for this mailbox.",
 },
 {
 to: "/$mailboxId/settings/danger",
 routeId: "/_dashboard/$mailboxId/settings/danger",
 group: "Safety",
 title: "Danger zone",
 description: "Permanently delete your account and all associated data.",
 destructive: true,
 },
] as const;

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
 "General",
 "Mail",
 "Safety",
];

export function findSettingsSectionByRouteId(
 routeId: string,
): SettingsSection | undefined {
 return SETTINGS_SECTIONS.find((section) => section.routeId === routeId);
}
