import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { EmailDetailContent } from "@/features/inbox/components/email-detail-content";
import { useRegisterEmailCommandHandler } from "@/features/inbox/hooks/use-email-command-state";
import { useForwardCompose } from "@/features/inbox/hooks/use-forward-compose";
import { useHotkeyScope } from "@/lib/hotkeys/use-scope";
import { patchEmail } from "@/features/inbox/mutations";
import type { ComposeInitial, EmailListItem, EmailListResponse } from "@/features/inbox/types";
import { buildForwardedEmailHtml } from "@/features/inbox/utils/build-forwarded-html";
import { openEmail as openInboxEmail } from "@/features/inbox/utils/open-email";
import { useSetPageContext } from "@/hooks/use-page-context";
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useMemo, useRef } from "react";

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

  const { forwardOpen, composeInitial, openForward, closeForward } = useForwardCompose();

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
      openInboxEmail(
        queryClient,
        navigate,
        nextEmail.mailboxId ?? mailboxId,
        nextEmail,
        {
        context: search.context ?? "inbox",
        replace: true,
        },
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

  const quickReplyRef = useRef<{ trigger: () => void } | null>(null);

  const invalidateEmail = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({
      queryKey: ["email-detail", params.emailId],
    });
    queryClient.invalidateQueries({
      queryKey: ["email-ai-detail", params.emailId],
    });
    void router.invalidate();
  }, [queryClient, params.emailId, router]);

  const archiveMutation = useMutation({
    mutationFn: () => patchEmail(params.emailId, { archived: true }),
    onSuccess: () => {
      invalidateEmail();
      goBack();
    },
  });

  const trashMutation = useMutation({
    mutationFn: () => patchEmail(params.emailId, { trashed: true }),
    onSuccess: () => {
      invalidateEmail();
      goBack();
    },
  });

  const toggleReadMutation = useMutation({
    mutationFn: () => patchEmail(params.emailId, { isRead: !email.isRead }),
    onSuccess: invalidateEmail,
  });

  const toggleStarMutation = useMutation({
    mutationFn: () => {
      const starred = email.labelIds.includes("STARRED");
      return patchEmail(params.emailId, { starred: !starred });
    },
    onSuccess: invalidateEmail,
  });

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

  useRegisterEmailCommandHandler(
    useCallback(
      (command) => {
        switch (command.type) {
          case "navigate-next":
            goToEmail("next");
            break;
          case "navigate-prev":
            goToEmail("prev");
            break;
          case "archive":
            archiveMutation.mutate();
            break;
          case "trash":
            trashMutation.mutate();
            break;
          case "escape":
            goBack();
            break;
          case "reply":
            quickReplyRef.current?.trigger();
            break;
          case "forward":
            handleForward();
            break;
          case "toggle-read":
            toggleReadMutation.mutate();
            break;
          case "toggle-star":
            toggleStarMutation.mutate();
            break;
        }
      },
      [
        archiveMutation,
        trashMutation,
        toggleReadMutation,
        toggleStarMutation,
        handleForward,
      ],
    ),
  );

  return (
    <>
      <div className="w-full max-w-3xl">
        <div className="min-w-0">
          <EmailDetailContent
            onClose={goBack}
            onBack={goBack}
            onPrev={() => goToEmail("prev")}
            onNext={() => goToEmail("next")}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onForward={handleForward}
            replyTriggerRef={quickReplyRef}
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
