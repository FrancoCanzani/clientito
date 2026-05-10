import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type {
	EmailDetailItem,
	EmailListItem,
	EmailListPage,
	EmailThreadItem,
} from "@/features/email/mail/types";
import { isEmailListInfiniteData } from "@/features/email/mail/utils/email-list-cache";
import { applyLabelPatch, STANDARD_LABELS } from "@/features/email/mail/utils/label-patch";
import type { QueryClient } from "@tanstack/react-query";
import type { InfiniteData, QueryKey } from "@tanstack/react-query";

export type EmailPatchPayload = {
 isRead?: boolean;
 archived?: boolean;
 trashed?: boolean;
 spam?: boolean;
 starred?: boolean;
 snoozedUntil?: number | null;
};

type PatchableEmail = Pick<
 EmailListItem,
 "id" | "providerMessageId" | "threadId" | "isRead" | "labelIds" | "snoozedUntil"
>;

type EmailTarget = {
 ids?: Iterable<string>;
 providerMessageIds?: Iterable<string>;
 threadId?: string;
};

function targetMatches(email: PatchableEmail, target: {
 ids: Set<string>;
 providerMessageIds: Set<string>;
 threadId?: string;
}) {
 return (
 target.ids.has(email.id) ||
 target.providerMessageIds.has(email.providerMessageId) ||
 (target.threadId != null && email.threadId === target.threadId)
 );
}

export function applyPatchToItem<
  T extends Pick<EmailListItem, "isRead" | "labelIds" | "snoozedUntil">,
>(item: T, patch: EmailPatchPayload): T {
  const result = applyLabelPatch(item.labelIds, !item.labelIds.includes(STANDARD_LABELS.UNREAD), patch);
  return {
    ...item,
    isRead: patch.isRead ?? !result.labelIds.includes(STANDARD_LABELS.UNREAD),
    labelIds: result.labelIds,
    snoozedUntil:
    patch.snoozedUntil !== undefined ? patch.snoozedUntil : item.snoozedUntil,
  };
}

export function applyPatchToLabelIds(
 labelIds: string[],
 patch: EmailPatchPayload,
): string[] {
return applyPatchToItem(
    { isRead: !labelIds.includes(STANDARD_LABELS.UNREAD), labelIds, snoozedUntil: null },
    patch,
  ).labelIds;
}

export function removeIdsFromInfiniteData(
 current: InfiniteData<EmailListPage> | undefined,
 ids: Set<string>,
): InfiniteData<EmailListPage> | undefined {
 if (!current) return current;
 let changed = false;
 const pages = current.pages.map((page) => {
 const emails = page.emails.filter((entry) => !ids.has(entry.id));
 if (emails.length === page.emails.length) return page;
 changed = true;
 return { ...page, emails };
 });
 return changed ? { ...current, pages } : current;
}

function patchListData<T extends EmailListPage>(
 current: InfiniteData<T> | undefined,
 target: ReturnType<typeof normalizeTarget>,
 patch: EmailPatchPayload,
): InfiniteData<T> | undefined {
 if (!current) return current;
 let changed = false;
 const pages = current.pages.map((page) => {
 let pageChanged = false;
 const emails = page.emails.map((entry) => {
 if (!targetMatches(entry, target)) return entry;
 pageChanged = true;
 changed = true;
 return applyPatchToItem(entry, patch);
 });
 return pageChanged ? { ...page, emails } : page;
 });
 return changed ? { ...current, pages } : current;
}

function normalizeTarget(target: EmailTarget) {
 return {
 ids: new Set(target.ids ?? []),
 providerMessageIds: new Set(target.providerMessageIds ?? []),
 threadId: target.threadId,
 };
}

export function applyMailPatchToCaches(
 queryClient: QueryClient,
 targetInput: EmailTarget,
 patch: EmailPatchPayload,
) {
 const target = normalizeTarget(targetInput);

 queryClient.setQueriesData<InfiniteData<EmailListPage> | undefined>(
 { queryKey: emailQueryKeys.all() },
 (current) => {
 if (!isEmailListInfiniteData(current)) return current;
 return patchListData(current, target, patch);
 },
 );

 const detailSnapshots = queryClient.getQueriesData<EmailDetailItem>({
 queryKey: ["email-detail"],
 });
 for (const [queryKey, detail] of detailSnapshots) {
 if (!detail || !targetMatches(detail, target)) continue;
 queryClient.setQueryData(queryKey, applyPatchToItem(detail, patch));
 }

 const threadSnapshots = queryClient.getQueriesData<EmailThreadItem[]>({
 queryKey: ["email-thread"],
 });
 for (const [queryKey, thread] of threadSnapshots) {
 if (!thread?.some((entry) => targetMatches(entry, target))) continue;
 queryClient.setQueryData(
 queryKey,
 thread.map((entry) =>
 targetMatches(entry, target) ? applyPatchToItem(entry, patch) : entry,
 ),
 );
 }
}

function isLabelScopedQuery(queryKey: QueryKey, labelId: string) {
 return queryKey[0] === "emails" && queryKey[1] === labelId;
}

function isTodoQueryForLabel(
 queryKey: QueryKey,
 data: InfiniteData<EmailListPage & { label?: { gmailId?: string } | null }>,
 labelId: string,
) {
 return (
 queryKey[0] === "emails" &&
 queryKey[1] === "todo" &&
 data.pages.some((page) => page.label?.gmailId === labelId)
 );
}

function patchLabelListData<T extends EmailListPage>(
 queryKey: QueryKey,
 current: InfiniteData<T> | undefined,
 providerMessageIds: Set<string>,
 labelId: string,
 apply: boolean,
): InfiniteData<T> | undefined {
 if (!current) return current;
 const maybeTodoData =
 current as InfiniteData<EmailListPage & { label?: { gmailId?: string } | null }>;
 const shouldRemove =
 !apply &&
 (isLabelScopedQuery(queryKey, labelId) ||
 isTodoQueryForLabel(queryKey, maybeTodoData, labelId));

 let changed = false;
 const pages = current.pages.map((page) => {
 let pageChanged = false;
 const emails = page.emails.flatMap((entry) => {
 if (!providerMessageIds.has(entry.providerMessageId)) return [entry];

 const labels = new Set(entry.labelIds);
 if (apply) labels.add(labelId);
 else labels.delete(labelId);

 if (shouldRemove && !labels.has(labelId)) {
 pageChanged = true;
 changed = true;
 return [];
 }

 pageChanged = true;
 changed = true;
 return [{ ...entry, labelIds: Array.from(labels) }];
 });
 return pageChanged ? { ...page, emails } : page;
 });

 return changed ? { ...current, pages } : current;
}

export function applyLabelToCaches(
 queryClient: QueryClient,
 providerMessageIds: string[],
 labelId: string,
 apply: boolean,
) {
 const providerSet = new Set(providerMessageIds);
 const listSnapshots = queryClient.getQueriesData<InfiniteData<EmailListPage>>({
 queryKey: emailQueryKeys.all(),
 });

 for (const [queryKey, data] of listSnapshots) {
 if (!isEmailListInfiniteData(data)) continue;
 queryClient.setQueryData(
 queryKey,
 patchLabelListData(queryKey, data, providerSet, labelId, apply),
 );
 }

 const updateLabels = <T extends { providerMessageId: string; labelIds: string[] }>(
 item: T,
 ): T => {
 if (!providerSet.has(item.providerMessageId)) return item;
 const labels = new Set(item.labelIds);
 if (apply) labels.add(labelId);
 else labels.delete(labelId);
 return { ...item, labelIds: Array.from(labels) };
 };

 const detailSnapshots = queryClient.getQueriesData<EmailDetailItem>({
 queryKey: ["email-detail"],
 });
 for (const [queryKey, detail] of detailSnapshots) {
 if (!detail || !providerSet.has(detail.providerMessageId)) continue;
 queryClient.setQueryData(queryKey, updateLabels(detail));
 }

 const threadSnapshots = queryClient.getQueriesData<EmailThreadItem[]>({
 queryKey: ["email-thread"],
 });
 for (const [queryKey, thread] of threadSnapshots) {
 if (!thread?.some((entry) => providerSet.has(entry.providerMessageId))) {
 continue;
 }
 queryClient.setQueryData(queryKey, thread.map(updateLabels));
 }
}
