import { EmailList } from "@/features/email/inbox/components/list/email-list";
import {
  SplitViewLayout,
  useSplitView,
} from "@/features/email/inbox/components/layout/split-view";
import { SplitDetailPanel } from "@/features/email/inbox/components/layout/split-detail-panel";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");

export default function InboxPage() {
  const { mailboxId } = route.useParams();
  const { initialPage } = route.useLoaderData();
  const emailData = useEmailData({ view: "inbox", mailboxId, initialPage });
  const isMobile = useIsMobile();
  const splitView = useSplitView();
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: "inbox",
    mailboxId,
  });

  const handleOpen = isMobile || !splitView.enabled
    ? openEmail
    : (email: Parameters<typeof openEmail>[0]) => splitView.select(email.id);

  const list = (
    <EmailList
      emailData={emailData}
      onOpen={handleOpen}
      onAction={executeEmailAction}
      selectedEmailId={splitView.enabled ? splitView.selectedEmailId : null}
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
              view="inbox"
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
