import { Kbd } from "@/components/ui/kbd";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { beginGmailConnection } from "@/features/onboarding/mutations";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { shortcutKey } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import {
 CheckIcon,
 GearSixIcon,
 NotePencilIcon,
 PlusIcon,
 TagIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import {
 Link,
 getRouteApi,
 useNavigate,
 useRouterState,
} from "@tanstack/react-router";
import { Hashvatar } from "hashvatar/react";
import { useMemo } from "react";
import {
 SidebarRowLabel,
 SidebarSection,
 sidebarRowClass,
 useSidebarExpanded,
} from "./sidebar-shared";
import {
 MAIL_SIDEBAR_ITEMS,
 findActiveMailItem,
 type SidebarRouteState,
} from "./sidebar-items";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

function useMailboxLabels(mailboxId: number) {
 const labelsQuery = useQuery({
 queryKey: labelQueryKeys.list(mailboxId),
 queryFn: () => fetchLabels(mailboxId),
 staleTime: 60_000,
 });

 return useMemo(() => {
 const collator = new Intl.Collator(undefined, {
 numeric: true,
 sensitivity: "base",
 });
 return [...(labelsQuery.data ?? [])]
 .filter(
 (label) => label.type === "user" && !isInternalLabelName(label.name),
 )
 .sort((a, b) => collator.compare(a.name, b.name));
 }, [labelsQuery.data]);
}

function useSidebarRouteState(): SidebarRouteState {
 return useRouterState({
 select: (state) => {
 const routeIds = state.matches.map((match) => match.routeId);
 const folder = state.matches.find(
 (match) =>
 match.routeId === "/_dashboard/$mailboxId/$folder/" ||
 match.routeId === "/_dashboard/$mailboxId/$folder/email/$emailId",
 )?.params.folder;
 const label = state.matches.find(
 (match) =>
 match.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/" ||
 match.routeId ===
 "/_dashboard/$mailboxId/inbox/labels/$label/email/$emailId",
 )?.params.label;
 return {
 routeIds,
 folder: typeof folder === "string" ? folder : null,
 label: typeof label === "string" ? label : null,
 };
 },
 });
}

export function MailboxSidebarContent({
 onNavigate,
}: {
 onNavigate?: () => void;
}) {
 const { mailboxId } = mailboxRoute.useParams();
 const mailboxAccounts = useMailboxes().data?.accounts ?? [];
 const accounts = useMemo(
 () =>
 [...mailboxAccounts]
 .filter((account) => account.mailboxId != null)
 .sort((left, right) => {
 const leftCreatedAt = left.createdAt ?? Number.POSITIVE_INFINITY;
 const rightCreatedAt = right.createdAt ?? Number.POSITIVE_INFINITY;
 return leftCreatedAt - rightCreatedAt;
 }),
 [mailboxAccounts],
 );
 const labels = useMailboxLabels(mailboxId);
 const routeState = useSidebarRouteState();
 const navigate = useNavigate();
 const { openCompose } = useMailCompose();
 const expanded = useSidebarExpanded();

 const activeItem = findActiveMailItem(routeState);
 const isSettingsRoute = routeState.routeIds.some((id) =>
 id.startsWith("/_dashboard/$mailboxId/settings"),
 );

 const switchMailbox = (nextMailboxId: number) => {
 const target = activeItem ?? MAIL_SIDEBAR_ITEMS[0]!;
 void navigate({
 to: target.to,
 params: target.params(nextMailboxId),
 });
 };

 return (
 <>
 <div className="shrink-0 border-b border-border/40 p-2">
 <div className="space-y-px">
 {accounts.map((account) => {
 const email =
 getMailboxDisplayEmail(account) ?? account.email ?? "";
 const active = account.mailboxId === mailboxId;
 const avatarHash = email.trim() || account.accountId;
 return (
 <button
 key={account.accountId}
 type="button"
 title={email}
 className={cn(sidebarRowClass, active && "bg-muted")}
 onClick={() => {
 if (!active && account.mailboxId != null) {
 switchMailbox(account.mailboxId);
 }
 onNavigate?.();
 }}
 >
 <Hashvatar
 hash={avatarHash}
 mode="dither"
 animated
 size={14}
 className="size-3.5 shrink-0 rounded"
 />
 <span
 className={cn(
 "min-w-0 flex-1 truncate text-left opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
 expanded && "opacity-100",
 )}
 >
 {email}
 </span>
 {active && (
 <CheckIcon
 className={cn(
 "size-3.5 opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
 expanded && "opacity-100",
 )}
 />
 )}
 </button>
 );
 })}
 <button
 type="button"
 title="Add account"
 className={sidebarRowClass}
 onClick={() => {
 void beginGmailConnection(`/${mailboxId}/settings`);
 onNavigate?.();
 }}
 >
 <span className="flex size-3.5 shrink-0 items-center justify-center bg-background">
 <PlusIcon className="size-3" />
 </span>
 <span
 className={cn(
 "min-w-0 flex-1 truncate text-left opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
 expanded && "opacity-100",
 )}
 >
 Add account
 </span>
 </button>
 </div>
 </div>

 <div className="shrink-0 pt-2">
 <SidebarSection title="Compose" hideTitle>
 <button
 type="button"
 title="New email"
 className={cn(
 "flex h-8 w-full items-center gap-3 overflow-hidden rounded border border-dashed border-blue-900/40 px-2 text-left text-xs text-blue-900 transition-colors hover:bg-blue-900/5",
 "dark:border-blue-50/40 dark:text-blue-50 dark:hover:bg-blue-50/5",
 )}
 onClick={() => {
 openCompose();
 onNavigate?.();
 }}
 >
 <NotePencilIcon className="size-3.5 shrink-0" />
 <span
 className={cn(
 "min-w-0 flex-1 truncate opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
 expanded && "opacity-100",
 )}
 >
 New email
 </span>
 <Kbd
 className={cn(
 "hidden group-hover/sidebar:inline-flex",
 expanded && "inline-flex",
 )}
 >
 {shortcutKey("action:compose")}
 </Kbd>
 </button>
 </SidebarSection>

 <SidebarSection title="Mail" hideTitle>
 {MAIL_SIDEBAR_ITEMS.map((item) => {
 const active = item.match(routeState);
 return (
 <Link
 key={item.id}
 to={item.to}
 params={item.params(mailboxId)}
 preload="viewport"
 title={item.label}
 className={cn(sidebarRowClass, active && "bg-muted")}
 onClick={onNavigate}
 >
 <SidebarRowLabel
 icon={item.icon}
 label={item.label}
 shortcutKey={
 item.shortcutId ? shortcutKey(item.shortcutId) : undefined
 }
 />
 </Link>
 );
 })}
 </SidebarSection>
 </div>

 {labels.length > 0 ? (
 <section
 className={cn(
 "flex min-h-0 flex-1 flex-col px-2 pt-1 pb-2",
 "hidden group-hover/sidebar:flex",
 expanded && "flex",
 )}
 >
 <div
 className={cn(
 "h-5 shrink-0 overflow-hidden px-2 text-xs font-medium opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100",
 expanded && "opacity-100",
 )}
 >
 Labels
 </div>
 <div className="min-h-0 flex-1 space-y-px overflow-y-auto">
 {labels.map((label) => {
 const active = routeState.label === label.gmailId;
 return (
 <Link
 key={label.gmailId}
 to="/$mailboxId/inbox/labels/$label"
 params={{ mailboxId, label: label.gmailId }}
 preload="viewport"
 title={label.name}
 className={cn(sidebarRowClass, active && "bg-muted")}
 onClick={onNavigate}
 >
 <SidebarRowLabel
 icon={TagIcon}
 label={label.name}
 count={label.messagesUnread}
 />
 </Link>
 );
 })}
 </div>
 </section>
 ) : (
 <div className="min-h-0 flex-1" />
 )}

 <div className="shrink-0 border-t border-border/40 p-2">
 <Link
 to="/$mailboxId/settings"
 params={{ mailboxId }}
 preload="viewport"
 title="Settings"
 className={cn(sidebarRowClass, isSettingsRoute && "bg-muted")}
 onClick={onNavigate}
 >
 <SidebarRowLabel
 icon={GearSixIcon}
 label="Settings"
 shortcutKey={shortcutKey("nav:settings")}
 />
 </Link>
 </div>
 </>
 );
}
