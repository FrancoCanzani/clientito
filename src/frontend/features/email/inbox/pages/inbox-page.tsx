import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import { Button } from "@/components/ui/button";
import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { fetchViewPage } from "@/features/email/inbox/queries";
import type { SplitViewRow } from "@/db/schema";
import { InboxSplitTabs } from "@/features/email/splits/components/inbox-split-tabs";
import { useSplitViews } from "@/features/email/splits/queries";
import { SlidersIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");

const ManageSplitsModal = lazy(async () => {
  const mod = await import("@/features/email/splits/components/manage-splits-modal");
  return { default: mod.ManageSplitsModal };
});

export default function InboxPage() {
  const { mailboxId } = route.useParams();
  const queryClient = useQueryClient();
  const [activeSplitId, setActiveSplitId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const { data: splits } = useSplitViews();
  const activeSplit = useMemo(
    () => splits?.find((s) => s.id === activeSplitId) ?? null,
    [splits, activeSplitId],
  );
  const emailData = useEmailData({
    view: "inbox",
    mailboxId,
    activeSplit,
  });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: "inbox",
    mailboxId,
  });

  const prefetchSplit = useCallback(
    (split: Pick<SplitViewRow, "id" | "rules">) => {
      void queryClient.prefetchInfiniteQuery({
        queryKey: emailQueryKeys.listScoped("inbox", mailboxId, split.id),
        queryFn: ({ pageParam }) =>
          fetchViewPage({
            view: "inbox",
            mailboxId,
            cursor: pageParam || undefined,
            splitRule: split.rules ?? null,
          }),
        initialPageParam: "",
        pages: 1,
        getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
      });
    },
    [mailboxId, queryClient],
  );

  useEffect(() => {
    const visibleSplits = (splits ?? []).filter((split) => split.visible);
    for (const split of visibleSplits) {
      prefetchSplit(split);
    }
  }, [splits, prefetchSplit]);

  const manageSplitsButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setManageOpen(true)}
      className="gap-1.5"
    >
      <SlidersIcon className="size-3.5" />
      <span>Splits</span>
    </Button>
  );

  const splitTabs = splits && splits.some((s) => s.visible) ? (
    <InboxSplitTabs
      splits={splits}
      activeSplitId={activeSplitId}
      onSelect={setActiveSplitId}
      onPrefetch={prefetchSplit}
    />
  ) : null;

  return (
    <>
      <EmailList
        emailData={emailData}
        onOpen={openEmail}
        onAction={executeEmailAction}
        headerSlot={splitTabs}
        extraActions={manageSplitsButton}
      />
      {manageOpen ? (
        <Suspense fallback={null}>
          <ManageSplitsModal
            open={manageOpen}
            onOpenChange={setManageOpen}
            onCreated={(id) => setActiveSplitId(id)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
