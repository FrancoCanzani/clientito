import { EmailDetailView } from "@/features/inbox/pages/email-detail-view";
import { getRouteApi } from "@tanstack/react-router";

const detailRoute = getRouteApi(
  "/_dashboard/$mailboxId/inbox/folders/$folder/email/$emailId",
);

export default function FolderEmailDetailPage() {
  const { mailboxId, folder, emailId } = detailRoute.useParams();
  const { email } = detailRoute.useLoaderData();
  const navigate = detailRoute.useNavigate();

  return (
    <EmailDetailView
      email={email}
      mailboxId={mailboxId}
      emailId={emailId}
      view={folder}
      onNavigateToEmail={(nextEmailId) =>
        navigate({
          to: "/$mailboxId/inbox/folders/$folder/email/$emailId",
          params: { mailboxId, folder, emailId: nextEmailId },
          replace: true,
        })}
    />
  );
}
