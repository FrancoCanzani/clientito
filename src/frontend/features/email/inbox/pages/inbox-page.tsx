import { Button } from "@/components/ui/button";
import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { InboxSplitTabs } from "@/features/email/splits/components/inbox-split-tabs";
import { ManageSplitsModal } from "@/features/email/splits/components/manage-splits-modal";
import { useSplitViews } from "@/features/email/splits/queries";
import { SlidersIcon } from "@phosphor-icons/react";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");

export default function InboxPage() {
  const { mailboxId } = route.useParams();
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
      <ManageSplitsModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        onCreated={(id) => setActiveSplitId(id)}
      />
    </>
  );
}
