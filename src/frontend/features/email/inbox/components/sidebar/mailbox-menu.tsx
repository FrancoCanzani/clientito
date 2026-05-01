import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { beginGmailConnection } from "@/features/onboarding/mutations";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { ListIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  getRouteApi,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

function getMailboxSwitchRoute(
  matches: ReturnType<typeof useRouterState>["matches"],
): {
  to: string;
  getParams: (mailboxId: number) => Record<string, unknown>;
} {
  if (
    matches.some((match) => match.routeId === "/_dashboard/$mailboxId/focus")
  ) {
    return {
      to: "/$mailboxId/focus",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some((match) => match.routeId === "/_dashboard/$mailboxId/todo")
  ) {
    return {
      to: "/$mailboxId/todo",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some(
      (match) => match.routeId === "/_dashboard/$mailboxId/reminders",
    )
  ) {
    return {
      to: "/$mailboxId/reminders",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some(
      (match) => match.routeId === "/_dashboard/$mailboxId/inbox/drafts",
    )
  ) {
    return {
      to: "/$mailboxId/inbox/drafts",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some(
      (match) => match.routeId === "/_dashboard/$mailboxId/inbox/search",
    )
  ) {
    return {
      to: "/$mailboxId/inbox/search",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }

  const folder = matches.find(
    (match) =>
      match.routeId === "/_dashboard/$mailboxId/$folder/" ||
      match.routeId === "/_dashboard/$mailboxId/$folder/email/$emailId",
  )?.params.folder;

  if (typeof folder === "string") {
    return {
      to: "/$mailboxId/$folder",
      getParams: (mailboxId) => ({ mailboxId, folder }),
    };
  }

  return {
    to: "/$mailboxId/inbox",
    getParams: (mailboxId) => ({ mailboxId }),
  };
}

export function MailboxMenu() {
  const { mailboxId } = mailboxRoute.useParams();
  const accounts = (useMailboxes().data?.accounts ?? []).filter(
    (account) => account.mailboxId != null,
  );
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const switchRoute = useRouterState({
    select: (state) => getMailboxSwitchRoute(state.matches),
  });
  const labelsQuery = useQuery({
    queryKey: labelQueryKeys.list(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const labels = useMemo(() => {
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return [...(labelsQuery.data ?? [])]
      .filter(
        (label) => label.type === "user" && !isInternalLabelName(label.name),
      )
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [labelsQuery.data]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={"ghost"} type="button" aria-label="Open mailbox menu">
          <ListIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-0" forceMount>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="mailbox-menu-body"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="p-1"
            >
              <DropdownMenuLabel className="text-[11px]">
                Accounts
              </DropdownMenuLabel>
              {accounts.map((account) => {
                const email =
                  getMailboxDisplayEmail(account) ?? account.email ?? "";
                const isActive = account.mailboxId === mailboxId;

                return (
                  <DropdownMenuItem
                    key={account.accountId}
                    onSelect={() => {
                      if (!isActive && account.mailboxId != null) {
                        void navigate({
                          to: switchRoute.to,
                          params: switchRoute.getParams(account.mailboxId),
                        });
                      }
                    }}
                    className="justify-between"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {email}
                    </span>
                    {isActive ? (
                      <span className="text-[10px] text-muted-foreground">
                        Current
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem
                onSelect={() => {
                  void beginGmailConnection(`/${mailboxId}/settings`);
                }}
              >
                Add account
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px]">
                Mail
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  to="/$mailboxId/inbox"
                  params={{ mailboxId }}
                  preload="viewport"
                >
                  Inbox
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/$mailboxId/$folder"
                  params={{ mailboxId, folder: "starred" }}
                  preload="viewport"
                >
                  Starred
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/$mailboxId/$folder"
                  params={{ mailboxId, folder: "archived" }}
                  preload="viewport"
                >
                  Done
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/$mailboxId/$folder"
                  params={{ mailboxId, folder: "sent" }}
                  preload="viewport"
                >
                  Sent
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/$mailboxId/inbox/drafts"
                  params={{ mailboxId }}
                  preload="viewport"
                >
                  Drafts
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/$mailboxId/$folder"
                  params={{ mailboxId, folder: "spam" }}
                  preload="viewport"
                >
                  Spam
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  to="/$mailboxId/$folder"
                  params={{ mailboxId, folder: "trash" }}
                  preload="viewport"
                >
                  Trash
                </Link>
              </DropdownMenuItem>
              {labels.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px]">
                    Labels
                  </DropdownMenuLabel>
                  <div className="max-h-52 overflow-y-auto">
                    {labels.map((label) => (
                      <DropdownMenuItem key={label.gmailId} asChild>
                        <Link
                          to="/$mailboxId/inbox/labels/$label"
                          params={{ mailboxId, label: label.gmailId }}
                          preload="viewport"
                          className="justify-between"
                        >
                          <span className="min-w-0 truncate">{label.name}</span>
                          {label.messagesUnread > 0 ? (
                            <span className="text-[10px] text-muted-foreground">
                              {label.messagesUnread}
                            </span>
                          ) : null}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px]">
                Settings
              </DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link
                  to="/$mailboxId/settings"
                  params={{ mailboxId }}
                  preload="viewport"
                >
                  Settings
                </Link>
              </DropdownMenuItem>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
