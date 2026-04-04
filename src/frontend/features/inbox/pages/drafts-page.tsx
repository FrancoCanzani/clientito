import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ComposePanel } from "../components/compose-panel";
import type { ComposeInitial } from "../types";
import {
  deleteDraft,
  draftsQueryOptions,
  getDraftsQueryKey,
  type DraftItem,
} from "../queries/drafts";
import { formatDistanceToNow } from "date-fns";
import { TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

function draftToComposeInitial(draft: DraftItem): ComposeInitial {
  const body = draft.forwardedContent
    ? `${draft.body}<p><br></p>${draft.forwardedContent}`
    : draft.body;

  return {
    mailboxId: draft.mailboxId,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject: draft.subject,
    bodyHtml: body,
    threadId: draft.threadId ?? undefined,
    composeKey: draft.composeKey,
  };
}

export default function DraftsPage({
  mailboxId,
}: {
  mailboxId: number | null;
}) {
  const { data: drafts = [], isLoading } = useQuery(draftsQueryOptions(mailboxId));
  const queryClient = useQueryClient();
  const [editingDraft, setEditingDraft] = useState<ComposeInitial | null>(null);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDraft(id);
    queryClient.invalidateQueries({ queryKey: getDraftsQueryKey(mailboxId) });
  };

  return (
    <div className="flex min-h-0 w-full max-w-3xl min-w-0 flex-1 flex-col">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="h-10 w-10 md:hidden [&>svg]:size-5" />
            <span>Drafts</span>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      ) : drafts.length === 0 ? (
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
              onClick={() => setEditingDraft(draftToComposeInitial(draft))}
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
                {draft.to && (
                  <p className="truncate text-xs text-muted-foreground">
                    To: {draft.to}
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

      <ComposePanel
        open={editingDraft != null}
        initial={editingDraft ?? undefined}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDraft(null);
            queryClient.invalidateQueries({ queryKey: getDraftsQueryKey(mailboxId) });
          }
        }}
      />
    </div>
  );
}
