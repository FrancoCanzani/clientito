import { openCompose as triggerOpenCompose } from "@/features/email/mail/compose/compose-events";
import { Command as Cmdk } from "cmdk";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { resolvePeople, type PeopleResult } from "./modes/people-resolver";
import { resolveSearch, type SearchResult } from "./modes/search-resolver";
import type { InputMode } from "./modes/types";
import type { CommandContext, CommandServices } from "./registry/types";

type SearchItem = {
 id: string;
 label: string;
 description: string | null;
 keywords?: string[];
 onSelect: () => void;
};

const GROUP_HEADING_CLASSES =
 "**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:capitalize **:[[cmdk-group-heading]]:text-muted-foreground";

const ITEM_CLASSES =
 "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs transition-colors data-[selected=true]:bg-muted";

export function SearchResultsPanel({
 mode,
 query,
 ctx,
 services,
}: {
 mode: InputMode;
 query: string;
 ctx: CommandContext;
 services: CommandServices;
}) {
 const [debouncedQuery] = useDebounce(query, 200);
 const [items, setItems] = useState<SearchItem[]>([]);
 const [loading, setLoading] = useState(false);
 const fallbackMailboxId = ctx.activeMailboxId ?? ctx.defaultMailboxId;

 useEffect(() => {
 if (!debouncedQuery || debouncedQuery.length < 2) {
 setItems([]);
 setLoading(false);
 return;
 }

 let cancelled = false;
 setLoading(true);

 const resolve = async () => {
 try {
 if (mode === "people") {
 const results: PeopleResult[] = await resolvePeople(debouncedQuery);
 if (cancelled) return;
 setItems(
 results.map((r) => ({
 id: r.id,
 label: r.label,
 description: r.description,
 keywords: [r.email],
 onSelect: () => {
 const mailboxId = fallbackMailboxId;
 if (mailboxId == null) return;

 const needsInboxNavigation =
 ctx.activeMailboxId !== mailboxId ||
 !ctx.currentRouteId.startsWith("/_dashboard/$mailboxId");

 if (needsInboxNavigation) {
 services.navigate({
 to: "/$mailboxId/inbox",
 params: { mailboxId },
 });
 }

 triggerOpenCompose({ mailboxId, to: r.email });
 services.close();
 },
 })),
 );
 } else if (mode === "search") {
 const results: SearchResult[] = await resolveSearch(
 debouncedQuery,
 fallbackMailboxId ?? undefined,
 );
 if (cancelled) return;
 setItems(
 results.map((r) => ({
 id: r.id,
 label: r.label,
 description: r.description,
 keywords: r.description ? [r.description] : undefined,
 onSelect: () => {
 const mailboxId = r.mailboxId ?? fallbackMailboxId;
 if (mailboxId == null) return;

 services.navigate({
 to: "/$mailboxId/inbox/email/$emailId",
 params: { mailboxId, emailId: r.emailId },
 });
 services.close();
 },
 })),
 );
 }
 } catch (error) {
 console.warn("Command palette search failed", error);
 } finally {
 if (!cancelled) setLoading(false);
 }
 };

 resolve();
 return () => {
 cancelled = true;
 };
 }, [
 ctx.activeMailboxId,
 ctx.currentRouteId,
 debouncedQuery,
 fallbackMailboxId,
 mode,
 services,
 ]);

 const emptyLabel =
 mode === "people" ? "Search for contacts…" : "Search for emails…";
 const groupLabel = mode === "people" ? "People" : "Emails";

 return (
 <Cmdk.List className="max-h-[min(56vh,24rem)] overflow-y-auto p-2">
 {loading && (
 <div className="px-3 py-4 text-center text-xs text-muted-foreground">
 Searching…
 </div>
 )}
 {!loading && (
 <Cmdk.Empty className="px-3 py-4 text-xs text-muted-foreground">
 {debouncedQuery.length >= 2 ? "No results found." : emptyLabel}
 </Cmdk.Empty>
 )}
 {items.length > 0 && (
 <Cmdk.Group heading={groupLabel} className={GROUP_HEADING_CLASSES}>
 {items.map((item) => (
 <Cmdk.Item
 key={item.id}
 value={item.label}
 keywords={item.keywords}
 onSelect={item.onSelect}
 className={ITEM_CLASSES}
 >
 <span className="min-w-0 flex-1 truncate">{item.label}</span>
 {item.description && (
 <span className="max-w-[40%] truncate text-xs text-muted-foreground">
 {item.description}
 </span>
 )}
 </Cmdk.Item>
 ))}
 </Cmdk.Group>
 )}
 </Cmdk.List>
 );
}
