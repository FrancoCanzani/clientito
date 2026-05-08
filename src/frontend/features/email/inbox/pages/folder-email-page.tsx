import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_dashboard/$mailboxId/$folder/email/$emailId");

export default function FolderEmailPage() {
 const { mailboxId, folder, emailId } = route.useParams();
 const navigate = route.useNavigate();

 return (
 <EmailDetailView
 mailboxId={mailboxId}
 emailId={emailId}
 view={folder}
 onNavigateToEmail={(nextEmailId) =>
 navigate({
 to: "/$mailboxId/$folder/email/$emailId",
 params: { mailboxId, folder, emailId: nextEmailId },
 replace: true,
 })}
 />
 );
}
