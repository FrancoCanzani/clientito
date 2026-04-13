import { EmailList } from "@/features/email/inbox/components/list/email-list";
import {
  SplitViewLayout,
  useSplitView,
} from "@/features/email/inbox/components/layout/split-view";
import { SplitDetailPanel } from "@/features/email/inbox/components/layout/split-detail-panel";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { fetchLabels } from "@/features/email/labels/queries";
import { queryKeys } from "@/lib/query-keys";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/labels/$label/");

export default function LabelPage() {
  const { mailboxId, label } = route.useParams();
  const emailData = useEmailData({ view: label, mailboxId });
  const labelsQuery = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });
  const labelName = labelsQuery.data?.find((l) => l.gmailId === label)?.name ?? label;
  const isMobile = useIsMobile();
  const splitView = useSplitView();
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: label,
    mailboxId,
  });

  const handleOpen = isMobile || !splitView.enabled
    ? openEmail
    : (email: Parameters<typeof openEmail>[0]) => splitView.select(email.id);

  const handleFocusChange = splitView.enabled
    ? (emailId: string | null) => splitView.select(emailId)
    : undefined;

  const list = (
    <EmailList
      emailData={emailData}
      onOpen={handleOpen}
      onAction={executeEmailAction}
      selectedEmailId={splitView.enabled ? splitView.selectedEmailId : null}
      pageTitle={labelName}
      onFocusChange={handleFocusChange}
    />
  );

  if (!isMobile && splitView.enabled) {
    return (
      <SplitViewLayout
        list={list}
        detail={
          splitView.selectedEmailId ? (
            <SplitDetailPanel
              emailId={splitView.selectedEmailId}
              mailboxId={mailboxId}
              view={label}
              onClose={() => splitView.select(null)}
              onNavigate={splitView.select}
            />
          ) : null
        }
      />
    );
  }

  return list;
}
