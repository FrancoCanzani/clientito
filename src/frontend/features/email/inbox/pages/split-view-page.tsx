import { PageSpinner } from "@/components/page-spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { SplitRule } from "@/db/schema";
import { useThreadGroupSnooze } from "@/features/email/inbox/hooks/use-thread-group-snooze";
import { MailListPane } from "@/features/email/inbox/pages/mail-pane";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import {
  MailboxPage,
  MailboxPageBody,
} from "@/features/email/shell/mailbox-page";
import {
  fetchSplitViews,
  getPrimarySplitViewLabelId,
} from "@/features/email/split-views/queries";
import { splitViewQueryKeys } from "@/features/email/split-views/query-keys";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/views/$viewId/");

export default function SplitViewPage() {
  const { mailboxId, viewId } = route.useParams();
  const splitViewsQuery = useQuery({
    queryKey: splitViewQueryKeys.all(),
    queryFn: fetchSplitViews,
    staleTime: 60_000,
  });
  const splitView = useMemo(
    () => splitViewsQuery.data?.find((view) => view.id === viewId) ?? null,
    [splitViewsQuery.data, viewId],
  );
  const labelId = getPrimarySplitViewLabelId(splitView);

  if (splitViewsQuery.isPending) {
    return (
      <MailboxPage>
        <MailboxPageBody>
          <PageSpinner />
        </MailboxPageBody>
      </MailboxPage>
    );
  }

  if (!splitView || !splitView.rules) {
    return (
      <MailboxPage>
        <MailboxPageBody>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>View unavailable</EmptyTitle>
              <EmptyDescription>
                This view could not be loaded.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </MailboxPageBody>
      </MailboxPage>
    );
  }

  return (
    <SplitViewContent
      mailboxId={mailboxId}
      title={splitView.name}
      view={labelId ?? "inbox"}
      splitRule={splitView.rules}
    />
  );
}

function SplitViewContent({
  mailboxId,
  title,
  view,
  splitRule,
}: {
  mailboxId: number;
  title: string;
  view: string;
  splitRule: SplitRule | null;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const emailData = useMailViewData({ view, mailboxId, splitRule });
  const { openEmail, executeEmailAction, snooze } = useMailActions({
    view,
    mailboxId,
  });
  const handleSnooze = useThreadGroupSnooze(mailboxId, snooze);

  return (
    <MailboxPage className="max-w-none">
      <MailListPane
        title={title}
        emailData={emailData}
        showFilters={showFilters}
        onShowFiltersChange={setShowFilters}
        onOpen={openEmail}
        onAction={executeEmailAction}
        onSnooze={handleSnooze}
      />
    </MailboxPage>
  );
}
