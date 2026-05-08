import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import {
 backfillMissingBodies,
 preloadInactiveViews,
} from "@/features/email/mail/queries";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const PRELOAD_DELAY_MS = 2_000;
const BACKFILL_DELAY_MS = 5_000;
const MAX_PRELOAD_LABELS = 8;

export function useViewPreload() {
 const { mailboxId: rawMailboxId } = mailboxRoute.useParams();
 const mailboxId = Number(rawMailboxId);

 const labelsQuery = useQuery({
 queryKey: labelQueryKeys.list(mailboxId),
 queryFn: () => fetchLabels(mailboxId),
 enabled: Number.isFinite(mailboxId) && mailboxId > 0,
 staleTime: 60_000,
 });
 const labels = labelsQuery.data;

 useEffect(() => {
 if (!Number.isFinite(mailboxId) || mailboxId <= 0) return;
 const preloadTimer = window.setTimeout(() => {
 const labelGmailIds = (labels ?? [])
 .filter((label) => !isInternalLabelName(label.name))
 .slice(0, MAX_PRELOAD_LABELS)
 .map((label) => label.gmailId);
 preloadInactiveViews(mailboxId, labelGmailIds);
 }, PRELOAD_DELAY_MS);
 const backfillTimer = window.setTimeout(() => {
 backfillMissingBodies(mailboxId);
 }, BACKFILL_DELAY_MS);
 return () => {
 window.clearTimeout(preloadTimer);
 window.clearTimeout(backfillTimer);
 };
 }, [mailboxId, labels]);
}
