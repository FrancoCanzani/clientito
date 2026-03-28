import { Button } from "@/components/ui/button";
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
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
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
    const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
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

  if (emailQuery.isError || !emailQuery.data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-12">
        <p className="text-sm text-muted-foreground">
          Could not load this email.
        </p>
        <Button variant="outline" size="sm" onClick={goBack}>
          <ArrowLeftIcon className="mr-1.5 size-3.5" />
          Back to inbox
        </Button>
      </div>
    );
  }

  const email = emailQuery.data as EmailListItem;

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto py-5">
          <EmailDetailContent
            key={email.id}
            email={email}
            onClose={goBack}
            onForward={forward}
            headerActions={
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  disabled={!hasPrev}
                  onClick={() => goToEmail("prev")}
                  title="Previous"
                >
                  <CaretUpIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  disabled={!hasNext}
                  onClick={() => goToEmail("next")}
                  title="Next"
                >
                  <CaretDownIcon className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={goBack}
                  title="Back"
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>
              </>
            }
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
