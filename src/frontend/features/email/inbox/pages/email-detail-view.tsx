import { EmailDetailContent } from "@/features/email/inbox/components/email-detail-content";
import { useInboxCompose } from "@/features/email/inbox/components/inbox-compose-provider";
import { fetchEmailThread } from "@/features/email/inbox/queries";
import type {
  ComposeInitial,
  EmailDetailItem,
  EmailListResponse,
} from "@/features/email/inbox/types";
import { buildForwardedEmailHtml } from "@/features/email/inbox/utils/build-forwarded-html";
import { openEmail as openInboxEmail } from "@/features/email/inbox/utils/open-email";
import type { EmailView } from "@/features/email/inbox/utils/inbox-filters";
import { useSetPageContext } from "@/hooks/use-page-context";
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

export function EmailDetailView({
  email,
  mailboxId,
  emailId,
  view,
  onNavigateToEmail,
}: {
  email: EmailDetailItem;
  mailboxId: number;
  emailId: string;
  view: EmailView;
  onNavigateToEmail: (nextEmailId: string) => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openCompose } = useInboxCompose();

  useSetPageContext(
    useMemo(() => {
      const bodyPreview = (email.resolvedBodyText ?? email.bodyText ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1500);
      return {
        route: "inbox",
        entity: {
          type: "email",
          id: email.id,
          subject: email.subject,
          fromName: email.fromName,
          fromAddr: email.fromAddr,
          threadId: email.threadId,
          mailboxId: email.mailboxId,
          bodyPreview: bodyPreview || null,
        },
      };
    }, [email]),
  );

  const orderedEmails = useMemo(() => {
    const cached = queryClient.getQueryData<InfiniteData<EmailListResponse>>([
      "emails",
      view,
      mailboxId,
    ]);
    return cached?.pages.flatMap((page) => page.data) ?? [];
  }, [queryClient, mailboxId, view]);

  const orderedIds = orderedEmails.map((item) => item.id);
  const orderedEmailById = new Map(orderedEmails.map((item) => [item.id, item]));

  const currentIndex = orderedIds.indexOf(emailId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < orderedIds.length - 1;

  const goToEmail = (direction: "prev" | "next") => {
    const nextIndex =
      direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const nextId = orderedIds[nextIndex];
    if (!nextId) return;

    const nextEmail = orderedEmailById.get(nextId);
    if (nextEmail) {
      openInboxEmail(
        queryClient,
        navigate,
        nextEmail.mailboxId ?? mailboxId,
        nextEmail,
        { context: view, replace: true },
      );
      return;
    }

    onNavigateToEmail(nextId);
  };

  const goBack = () => {
    router.history.back();
  };

  const threadQuery = useQuery({
    queryKey: ["email-thread", email.threadId],
    queryFn: () => fetchEmailThread(email.threadId!),
    enabled: Boolean(email.threadId),
    staleTime: 60_000,
  });

  const threadMessages = useMemo(() => {
    if (!email.threadId) return [email];
    return threadQuery.data?.length ? threadQuery.data : [email];
  }, [email, threadQuery.data]);

  const handleForward = useCallback(
    (initial?: ComposeInitial) => {
      if (initial) {
        openCompose(initial);
        return;
      }
      const subject = email.subject
        ? email.subject.startsWith("Fwd:")
          ? email.subject
          : `Fwd: ${email.subject}`
        : "Fwd:";
      const bodyHtml = buildForwardedEmailHtml(email);
      openCompose({ subject, bodyHtml });
    },
    [email, openCompose],
  );

  return (
    <div className="w-full max-w-3xl">
      <div className="min-w-0">
        <EmailDetailContent
          email={email}
          threadMessages={threadMessages}
          threadError={threadQuery.isError}
          onClose={goBack}
          onBack={goBack}
          onPrev={() => goToEmail("prev")}
          onNext={() => goToEmail("next")}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onForward={handleForward}
        />
      </div>
    </div>
  );
}
