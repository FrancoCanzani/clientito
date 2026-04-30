import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/email/$emailId");

export default function InboxEmailPage() {
  const { mailboxId, emailId } = route.useParams();
  const navigate = route.useNavigate();

  return (
    <EmailDetailView
      mailboxId={mailboxId}
      emailId={emailId}
      view="inbox"
      onNavigateToEmail={(nextEmailId) =>
        navigate({
          to: "/$mailboxId/inbox/email/$emailId",
          params: { mailboxId, emailId: nextEmailId },
          replace: true,
        })}
    />
  );
}
