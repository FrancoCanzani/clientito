import { EmailList } from "@/features/email/inbox/components/list/email-list";
import {
  SplitViewLayout,
  useSplitView,
} from "@/features/email/inbox/components/layout/split-view";
import { SplitDetailPanel } from "@/features/email/inbox/components/layout/split-detail-panel";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useIsMobile } from "@/hooks/use-mobile";

export function EmailListPage({
  view,
  mailboxId,
}: {
  view: string;
  mailboxId: number;
}) {
  const emailData = useEmailData({ view, mailboxId });
  const isMobile = useIsMobile();
  const splitView = useSplitView();
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view,
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
      onFocusChange={handleFocusChange}
    />
  );

  if (!isMobile && splitView.enabled) {
    return (
      <div className="h-full min-h-0 min-w-0 overflow-hidden">
        <SplitViewLayout
          list={list}
          detail={
            splitView.selectedEmailId ? (
              <SplitDetailPanel
                emailId={splitView.selectedEmailId}
                mailboxId={mailboxId}
                view={view}
                onClose={() => splitView.select(null)}
                onNavigate={splitView.select}
              />
            ) : null
          }
        />
      </div>
    );
  }

  return list;
}
