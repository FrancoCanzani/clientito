import { Skeleton } from "@/components/ui/skeleton";
import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { EmailDetailContent } from "@/features/inbox/components/email-detail-content";
import { fetchEmailDetail } from "@/features/inbox/queries";
import type {
  ComposeInitial,
  EmailListItem,
  EmailListResponse,
} from "@/features/inbox/types";
import { openEmail as openInboxEmail } from "@/features/inbox/utils/open-email";
import { useSetPageContext } from "@/hooks/use-page-context";
import { parseMailboxId } from "@/lib/utils";
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

const detailRoute = getRouteApi("/_dashboard/inbox/$id/email/$emailId");

export default function EmailDetailPage() {
  const params = detailRoute.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mailboxId = parseMailboxId(params.id);

  const [composeInitial, setComposeInitial] = useState<
    ComposeInitial | undefined
  >();
  const [forwardOpen, setForwardOpen] = useState(false);

  const forward = (initial: ComposeInitial) => {
    setComposeInitial(initial);
    setForwardOpen(true);
  };

  const closeForward = () => {
    setForwardOpen(false);
    setComposeInitial(undefined);
  };

  const emailQuery = useQuery({
    queryKey: ["email-detail", params.emailId],
    queryFn: () => fetchEmailDetail(params.emailId),
    staleTime: 60_000,
  });

  const emailData = emailQuery.data;

  useSetPageContext(
    useMemo(() => {
      if (!emailData) return { route: "inbox" };
      const bodyPreview = (
        emailData.resolvedBodyText ??
        emailData.bodyText ??
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1500);
      return {
        route: "inbox",
        entity: {
          type: "email" as const,
          id: emailData.id,
          subject: emailData.subject,
          fromName: emailData.fromName,
          fromAddr: emailData.fromAddr,
          threadId: emailData.threadId,
          mailboxId: emailData.mailboxId,
          bodyPreview: bodyPreview || null,
        },
      };
    }, [emailData]),
  );

  const orderedEmails = useMemo(() => {
    const cached = queryClient.getQueryData<InfiniteData<EmailListResponse>>([
      "emails",
      "inbox",
      mailboxId ?? "all",
    ]);
    if (!cached) return [] as EmailListItem[];
    return cached.pages.flatMap((page) => page.data);
  }, [queryClient, mailboxId]);

  const orderedIds = useMemo(
    () => orderedEmails.map((email) => email.id),
    [orderedEmails],
  );

  const orderedEmailById = useMemo(
    () => new Map(orderedEmails.map((email) => [email.id, email])),
    [orderedEmails],
  );

  const currentIndex = orderedIds.indexOf(params.emailId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < orderedIds.length - 1;

  const goToEmail = (direction: "prev" | "next") => {
    const nextIndex =
      direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const nextId = orderedIds[nextIndex];
    if (!nextId) return;

    const nextEmail = orderedEmailById.get(nextId);
    if (nextEmail) {
      openInboxEmail(queryClient, navigate, params.id, nextEmail, {
        replace: true,
      });
      return;
    }

    navigate({
      to: "/inbox/$id/email/$emailId",
      params: { id: params.id, emailId: nextId },
      replace: true,
    });
  };

  const goBack = () => {
    navigate({ to: "/inbox/$id", params: { id: params.id } });
  };

  if (emailQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 py-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (emailQuery.isError) {
    throw emailQuery.error;
  }

  if (!emailQuery.data) {
    return null;
  }

  const email = emailQuery.data;

  return (
    <>
      <div className="mx-auto w-full max-w-3xl">
        <div className="min-w-0">
          <EmailDetailContent
            key={email.id}
            email={email}
            onClose={goBack}
            onBack={goBack}
            onPrev={() => goToEmail("prev")}
            onNext={() => goToEmail("next")}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onForward={forward}
          />
        </div>
      </div>
      <ComposePanel
        open={forwardOpen}
        initial={composeInitial}
        onOpenChange={(open) => {
          if (!open) closeForward();
        }}
      />
    </>
  );
}
