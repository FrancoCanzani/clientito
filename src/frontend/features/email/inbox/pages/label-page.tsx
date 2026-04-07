import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi(
  "/_dashboard/$mailboxId/inbox/labels/$label/email/$emailId",
);

export default function LabelPage() {
  const { mailboxId, label, emailId } = route.useParams();
  const { email } = route.useLoaderData();
  const navigate = route.useNavigate();

  return (
    <EmailDetailView
      email={email}
      mailboxId={mailboxId}
      emailId={emailId}
      view={label}
      onNavigateToEmail={(nextEmailId) =>
        navigate({
          to: "/$mailboxId/inbox/labels/$label/email/$emailId",
          params: { mailboxId, label, emailId: nextEmailId },
          replace: true,
        })}
    />
  );
}
