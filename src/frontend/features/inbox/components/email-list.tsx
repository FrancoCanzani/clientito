import { AccountSwitcher } from "@/components/account-switcher";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useEmail } from "@/features/inbox/context/email-context";
import { VIEW_LABELS } from "@/features/inbox/utils/inbox-filters";
import { Link, getRouteApi } from "@tanstack/react-router";
import { EmailContextMenu } from "./email-context-menu";
import { EmailRow } from "./email-row";

const emailsRoute = getRouteApi("/_dashboard/inbox/$id/");

export function EmailList() {
  const search = emailsRoute.useSearch();
  const {
    view,
    mailboxId,
    displayRows,
    sections,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
    openEmail,
    executeEmailAction,
  } = useEmail();

  const pageTitle = VIEW_LABELS[view];

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-background py-2">
          <h2 className="text-xl font-medium">{pageTitle}</h2>
          <div className="flex items-center justify-end gap-2">
            <AccountSwitcher />

            <Button asChild size="sm" variant={"secondary"}>
              <Link
                to="/inbox/$id"
                params={{ id: mailboxId != null ? String(mailboxId) : "all" }}
                search={{
                  view: search.view,
                  compose: true,
                }}
              >
                New Email
              </Link>
            </Button>
          </div>
        </header>

        {displayRows.length > 0 ? (
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.label} className="space-y-1.5">
                <div className="sticky top-9 z-10 bg-background py-2 text-xs text-muted-foreground">
                  {section.label}
                </div>
                <div className="space-y-1 [&:has(>[data-email-row]:hover)>[data-email-row]:not(:hover)]:opacity-85">
                  {section.items.map((group) => {
                    const email = group.representative;

                    return (
                      <EmailContextMenu
                        key={email.id}
                        targetEmail={email}
                        onArchive={() => executeEmailAction("archive", [email.id])}
                        onTrash={() => executeEmailAction("trash", [email.id])}
                        onSpam={() => executeEmailAction("spam", [email.id])}
                        onSetRead={(read) =>
                          executeEmailAction(
                            read ? "mark-read" : "mark-unread",
                            [email.id],
                          )
                        }
                        onSetStarred={(starred) =>
                          executeEmailAction(
                            starred ? "star" : "unstar",
                            [email.id],
                          )
                        }
                      >
                        <EmailRow
                          email={email}
                          threadCount={group.threadCount}
                          view={view}
                          isOpen={false}
                          onOpen={() => openEmail(email)}
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
    </div>
  );
}
