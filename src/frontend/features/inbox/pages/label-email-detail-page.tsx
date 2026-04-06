import { EmailDetailView } from "@/features/inbox/pages/email-detail-view";
import { getRouteApi } from "@tanstack/react-router";

const detailRoute = getRouteApi(
  "/_dashboard/$mailboxId/inbox/labels/$label/email/$emailId",
);

export default function LabelEmailDetailPage() {
  const { mailboxId, label, emailId } = detailRoute.useParams();
  const { email } = detailRoute.useLoaderData();
  const navigate = detailRoute.useNavigate();

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
