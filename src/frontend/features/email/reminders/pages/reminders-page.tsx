import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useReminderData } from "@/features/email/reminders/hooks/use-reminder-data";

export const REMINDERS_VIEW = "snoozed";

export function RemindersPage({ mailboxId }: { mailboxId: number }) {
  const emailData = useReminderData({ mailboxId });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: REMINDERS_VIEW,
    mailboxId,
  });

  return (
    <EmailList
      emailData={emailData}
      onOpen={openEmail}
      onAction={executeEmailAction}
      hideFilterControls
      enableKeyboardNavigation={false}
      listVariant="task"
      emptyTitle="No reminders."
      emptyDescription="Snooze an email to bring it back later."
    />
  );
}
