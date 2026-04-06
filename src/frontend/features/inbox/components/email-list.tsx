import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { openCompose } from "@/features/inbox/components/compose-events";
import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import type { EmailInboxAction } from "@/features/inbox/hooks/use-email-inbox-actions";
import type { EmailListItem } from "@/features/inbox/types";
import { VIEW_LABELS } from "@/features/inbox/utils/inbox-filters";
import { EmailContextMenu } from "./email-context-menu";
import { EmailRow } from "./email-row";

export function EmailList({
  emailData,
  onOpen,
  onAction,
}: {
  emailData: ReturnType<typeof useEmailData>;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
}) {
  const {
    view,
    mailboxId,
    displayRows,
    sections,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
  } = emailData;
  const pageTitle = VIEW_LABELS[view];

  return (
    <div className="flex min-h-0 w-full max-w-3xl min-w-0 flex-1 flex-col">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>{pageTitle}</span>
          </div>
        }
        actions={
          view === "inbox" && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => openCompose({ mailboxId })}
            >
              New Email
            </Button>
          )
        }
      />

      {displayRows.length > 0 ? (
        <div className="space-y-1">
          {sections.map((section) => (
            <section key={section.label} className="space-y-1.5">
              <div className="sticky top-12 z-10 bg-background pt-4 pb-2 text-xs text-muted-foreground">
                {section.label}
              </div>
              <div className="space-y-1">
                {section.items.map((group) => {
                  const email = group.representative;

                  return (
                    <EmailContextMenu
                      key={email.id}
                      targetEmail={email}
                      onAction={onAction}
                    >
                      <EmailRow
                        group={group}
                        isOpen={false}
                        view={view}
                        onOpen={onOpen}
                        onAction={onAction}
                      />
                    </EmailContextMenu>
                  );
                })}
              </div>
            </section>
          ))}

          {hasNextPage && (
            <div
              ref={loadMoreRef}
              className="pt-2 text-center text-xs text-muted-foreground"
            >
              {isFetchingNextPage ? "Loading more..." : "Scroll for more"}
            </div>
          )}
        </div>
      ) : (
        <Empty className="min-h-56 flex-1 justify-center">
          <EmptyHeader>
            <EmptyTitle>No emails in {pageTitle.toLowerCase()}</EmptyTitle>
            <EmptyDescription>
              Messages that belong to this view will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
