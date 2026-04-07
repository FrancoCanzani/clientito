import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi(
  "/_dashboard/$mailboxId/inbox/folders/$folder/email/$emailId",
);

export default function FolderPage() {
  const { mailboxId, folder, emailId } = route.useParams();
  const { email } = route.useLoaderData();
  const navigate = route.useNavigate();

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
