import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { htmlToPlainText } from "@/features/email/mail/render/html-to-plain-text";
import {
  deleteDraft,
  fetchDrafts,
} from "@/features/email/mail/shared/data/drafts";
import { draftQueryKeys } from "@/features/email/mail/shared/query-keys";
import type {
  ComposeInitial,
  DraftItem,
} from "@/features/email/mail/shared/types";
import {
  MailboxPage,
  MailboxPageBody,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { TrashIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/drafts");

function draftToComposeInitial(draft: DraftItem): ComposeInitial {
  const body = draft.forwardedContent
    ? `${draft.body}<p><br></p>${draft.forwardedContent}`
    : draft.body;

  return {
    mailboxId: draft.mailboxId,
    to: draft.toAddr,
    cc: draft.ccAddr,
    bcc: draft.bccAddr,
    subject: draft.subject,
    bodyHtml: body,
    threadId: draft.threadId ?? undefined,
    composeKey: draft.composeKey,
  };
}

export default function DraftsPage() {
  const { drafts: initialDrafts } = route.useLoaderData();
  const { mailboxId } = route.useParams();
  const numericMailboxId = Number(mailboxId);
  const queryClient = useQueryClient();
  const { openCompose } = useMailCompose();

  const draftsQuery = useQuery({
    queryKey: draftQueryKeys.list(numericMailboxId),
    queryFn: () => fetchDrafts(numericMailboxId),
    initialData: initialDrafts,
  });
  const drafts = draftsQuery.data ?? [];

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDraft(id);
    void queryClient.invalidateQueries({
      queryKey: draftQueryKeys.list(numericMailboxId),
    });
  };

  return (
    <MailboxPage className="max-w-none">
      <MailboxPageHeader title="Drafts" />

      <MailboxPageBody>
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {drafts.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No drafts</EmptyTitle>
                <EmptyDescription>
                  Drafts are saved automatically as you compose emails.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-1 px-3 py-1.5 md:px-4">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  role="button"
                  tabIndex={0}
                  className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => openCompose(draftToComposeInitial(draft))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openCompose(draftToComposeInitial(draft));
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium">
                        {draft.subject || "(no subject)"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(draft.updatedAt, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {draft.toAddr && (
                      <p className="truncate text-xs text-muted-foreground">
                        To: {draft.toAddr}
                      </p>
                    )}
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/60">
                      {htmlToPlainText(draft.body).slice(0, 120) || "(empty)"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => handleDelete(draft.id, e)}
                    title="Delete draft"
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </MailboxPageBody>
    </MailboxPage>
  );
}
