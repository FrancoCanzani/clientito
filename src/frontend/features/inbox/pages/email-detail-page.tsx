import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { EmailDetailContent } from "@/features/inbox/components/email-detail-content";
import { useForwardCompose } from "@/features/inbox/hooks/use-forward-compose";
import { fetchEmailThread } from "@/features/inbox/queries";
import type {
  ComposeInitial,
  EmailListItem,
  EmailListResponse,
} from "@/features/inbox/types";
import { buildForwardedEmailHtml } from "@/features/inbox/utils/build-forwarded-html";
import { openEmail as openInboxEmail } from "@/features/inbox/utils/open-email";
import { useSetPageContext } from "@/hooks/use-page-context";
import { useHotkeyScope } from "@/lib/hotkeys/use-scope";
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

const detailRoute = getRouteApi("/_dashboard/$mailboxId/inbox/email/$emailId");

export default function EmailDetailPage() {
  useHotkeyScope("inbox");
  const params = detailRoute.useParams();
  const search = detailRoute.useSearch();
  const { email } = detailRoute.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mailboxId } = params;

  const { forwardOpen, composeInitial, openForward, closeForward } =
    useForwardCompose();

  useSetPageContext(
    useMemo(() => {
      const bodyPreview = (email.resolvedBodyText ?? email.bodyText ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1500);
      return {
        route: "inbox",
        entity: {
          type: "email" as const,
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
      search.context ?? "inbox",
      mailboxId,
    ]);
    if (!cached) return [] as EmailListItem[];
    return cached.pages.flatMap((page) => page.data);
  }, [queryClient, mailboxId, search.context]);

  const orderedIds = useMemo(
    () => orderedEmails.map((e) => e.id),
    [orderedEmails],
  );

  const orderedEmailById = useMemo(
    () => new Map(orderedEmails.map((e) => [e.id, e])),
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
      openInboxEmail(
        queryClient,
        navigate,
        nextEmail.mailboxId ?? mailboxId,
        nextEmail,
        { context: search.context ?? "inbox", replace: true },
      );
      return;
    }

    navigate({
      to: "/$mailboxId/inbox/email/$emailId",
      params: { mailboxId, emailId: nextId },
      search: {
        context:
          search.context && search.context !== "inbox"
            ? search.context
            : undefined,
      },
      replace: true,
    });
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
        openForward(initial);
        return;
      }
      const subject = email.subject
        ? email.subject.startsWith("Fwd:")
          ? email.subject
          : `Fwd: ${email.subject}`
        : "Fwd:";
      const bodyHtml = buildForwardedEmailHtml(email);
      openForward({ mailboxId: email.mailboxId, subject, bodyHtml });
    },
    [email, openForward],
  );

  return (
    <>
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
