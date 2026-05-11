import { PageSpinner } from "@/components/page-spinner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  fetchEmailDetail,
  fetchEmailThread,
} from "@/features/email/mail/data/thread-detail";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { EmailThread } from "@/features/email/mail/thread/email-thread";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";

const route = getRouteApi("/email/$mailboxId/$emailId");

export default function FullEmailPage() {
  const { mailboxId, emailId } = route.useParams();

  const emailQuery = useQuery({
    queryKey: emailQueryKeys.detail(emailId),
    queryFn: () => fetchEmailDetail(emailId, { mailboxId, view: "inbox" }),
    staleTime: 60_000,
    gcTime: 2 * 60_000,
  });

  const threadId = emailQuery.data?.threadId ?? null;
  const threadQuery = useQuery({
    queryKey: emailQueryKeys.thread(threadId ?? "none"),
    queryFn: () =>
      threadId ? fetchEmailThread(threadId) : Promise.resolve([]),
    enabled: Boolean(threadId),
    staleTime: 60_000,
    gcTime: 2 * 60_000,
  });

  const subject = emailQuery.data?.subject ?? null;
  useEffect(() => {
    if (!subject) return;
    const previous = document.title;
    document.title = subject || "(no subject)";
    return () => {
      document.title = previous;
    };
  }, [subject]);

  if (emailQuery.isError) {
    const message =
      emailQuery.error instanceof Error
        ? emailQuery.error.message
        : "Unable to load email";

    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Unable to open email</EmptyTitle>
            <EmptyDescription>{message}</EmptyDescription>
          </EmptyHeader>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void emailQuery.refetch()}
          >
            Retry
          </Button>
        </Empty>
      </div>
    );
  }

  if (!emailQuery.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <PageSpinner />
      </div>
    );
  }

  const email = emailQuery.data;
  const threadMessages = threadQuery.data ?? [];

  return (
    <div
      data-print-region
      className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10"
    >
      <EmailThread
        email={email}
        threadMessages={threadMessages}
        threadError={threadQuery.isError}
      />
    </div>
  );
}
