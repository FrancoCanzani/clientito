import {
 SETTINGS_GROUPS,
 SETTINGS_SECTIONS,
 type SettingsGroup,
} from "@/features/settings/components/settings-sections";
import { cn } from "@/lib/utils";
import {
 ArrowLeftIcon,
 AtIcon,
 BugIcon,
 GearSixIcon,
 PaintBrushIcon,
 PencilSimpleIcon,
 ShieldWarningIcon,
 SignatureIcon,
 SparkleIcon,
 TagIcon,
 UserIcon,
 WrenchIcon,
 type Icon,
} from "@phosphor-icons/react";
import {
 Link,
 getRouteApi,
 useRouterState,
} from "@tanstack/react-router";
import {
 SidebarRowLabel,
 SidebarSection,
 sidebarRowClass,
} from "./sidebar-shared";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const SECTION_ICONS: Record<string, Icon> = {
 "/$mailboxId/settings/account": UserIcon,
 "/$mailboxId/settings/appearance": PaintBrushIcon,
 "/$mailboxId/settings/mailbox": AtIcon,
 "/$mailboxId/settings/signatures": SignatureIcon,
 "/$mailboxId/settings/templates": PencilSimpleIcon,
 "/$mailboxId/settings/labels": TagIcon,
 "/$mailboxId/settings/ai": SparkleIcon,
 "/$mailboxId/settings/performance": BugIcon,
 "/$mailboxId/settings/danger": ShieldWarningIcon,
};

export function SettingsSidebarContent({
 onNavigate,
}: {
 onNavigate?: () => void;
}) {
 const { mailboxId } = mailboxRoute.useParams();
 const activeRouteId = useRouterState({
 select: (state) =>
 state.matches
 .map((match) => match.routeId)
 .find((id) => id.startsWith("/_dashboard/$mailboxId/settings/")) ??
 null,
 });

 const sectionsByGroup = SETTINGS_GROUPS.map((group) => ({
 group,
 sections: SETTINGS_SECTIONS.filter((section) => section.group === group),
 })).filter((entry) => entry.sections.length > 0);

 return (
 <>
 <div className="shrink-0 border-b border-border/40 p-2">
 <Link
 to="/$mailboxId/inbox"
 params={{ mailboxId }}
 preload="viewport"
 title="Back to inbox"
 className={sidebarRowClass}
 onClick={onNavigate}
 >
 <SidebarRowLabel icon={ArrowLeftIcon} label="Inbox" />
 </Link>
 </div>

 <div className="shrink-0 pt-2">
 <SidebarSection title="Settings" hideTitle>
 <div
 title="Settings"
 className={cn(sidebarRowClass, "cursor-default text-muted-foreground hover:bg-transparent")}
 >
 <SidebarRowLabel icon={GearSixIcon} label="Settings" />
 </div>
 </SidebarSection>
 </div>

 <div className="min-h-0 flex-1 overflow-y-auto pb-2">
 {sectionsByGroup.map(({ group, sections }) => (
 <SettingsGroupSection
 key={group}
 group={group}
 sections={sections}
 mailboxId={mailboxId}
 activeRouteId={activeRouteId}
 onNavigate={onNavigate}
 />
 ))}
 </div>
 </>
 );
}

function SettingsGroupSection({
 group,
 sections,
 mailboxId,
 activeRouteId,
 onNavigate,
}: {
 group: SettingsGroup;
 sections: typeof SETTINGS_SECTIONS;
 mailboxId: number;
 activeRouteId: string | null;
 onNavigate?: () => void;
}) {
 return (
 <SidebarSection title={group}>
 {sections.map((section) => {
 const active = activeRouteId === section.routeId;
 const icon = SECTION_ICONS[section.to] ?? WrenchIcon;
 return (
 <Link
 key={section.to}
 to={section.to}
 params={{ mailboxId }}
 preload="viewport"
 title={section.title}
 className={cn(
 sidebarRowClass,
 active && "bg-muted",
 section.destructive && "hover:text-destructive",
 section.destructive && active && "bg-destructive/10 text-destructive",
 )}
 onClick={onNavigate}
 >
 <SidebarRowLabel icon={icon} label={section.title} />
 </Link>
 );
 })}
 </SidebarSection>
 );
}
