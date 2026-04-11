import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useInboxCompose } from "@/features/email/inbox/components/inbox-compose-provider";
import { TrashIcon } from "@phosphor-icons/react";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { deleteDraft } from "../queries";
import type { ComposeInitial, DraftItem } from "../types";
import { htmlToPlainText } from "../utils/html-to-plain-text";

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
  const { drafts } = route.useLoaderData();
  const router = useRouter();
  const { openCompose } = useInboxCompose();

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDraft(id);
    void router.invalidate();
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>Drafts</span>
          </div>
        }
      />

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
        <div className="space-y-1">
          {drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              onClick={() => openCompose(draftToComposeInitial(draft))}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium">
                    {draft.subject || "(no subject)"}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(draft.updatedAt, { addSuffix: true })}
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
