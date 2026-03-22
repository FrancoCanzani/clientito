import { useEmail } from "@/features/inbox/context/email-context";
import { EmailDetailSheet } from "./email-detail-sheet";
import { EmailList } from "./email-list";

export function InboxMobileView() {
  const { selectedEmail, closeEmail } = useEmail();

  return (
    <>
      <EmailList />
      <EmailDetailSheet
        email={selectedEmail}
        open={selectedEmail !== null}
        onOpenChange={(open) => {
          if (!open) closeEmail();
        }}
      />
    </>
  );
}
