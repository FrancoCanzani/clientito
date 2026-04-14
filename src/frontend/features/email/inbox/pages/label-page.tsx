import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { fetchLabels } from "@/features/email/labels/queries";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/labels/$label/");

export default function LabelPage() {
  const { mailboxId, label } = route.useParams();
  const emailData = useEmailData({ view: label, mailboxId });
  const labelsQuery = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });
  const labelName = labelsQuery.data?.find((l) => l.gmailId === label)?.name ?? label;
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: label,
    mailboxId,
  });

  return (
    <EmailList
      emailData={emailData}
      onOpen={openEmail}
      onAction={executeEmailAction}
      pageTitle={labelName}
    />
  );
}
