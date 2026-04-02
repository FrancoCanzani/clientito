import { AccountSwitcher } from "@/components/account-switcher";
import { PageHeader } from "@/components/page-header";
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
  } = useEmail();

  const pageTitle = VIEW_LABELS[view];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-6">
        <PageHeader
          title={pageTitle}
          actions={
            <>
              <AccountSwitcher />
              <Button asChild variant={"ghost"}>
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
            </>
          }
        />

        {displayRows.length > 0 ? (
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.label} className="space-y-1.5">
                <div className="sticky top-12 z-10 bg-background py-2 my-2 text-xs text-muted-foreground">
                  {section.label}
                </div>
                <div className="space-y-1">
                  {section.items.map((group) => {
                    const email = group.representative;

                    return (
                      <EmailContextMenu key={email.id} targetEmail={email}>
                        <EmailRow group={group} isOpen={false} />
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
