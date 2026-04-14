import {
  isEmailView,
  isEmailFolderView,
  type EmailView,
} from "@/features/email/inbox/utils/inbox-filters";
import { getMailboxDisplayEmail, useMailboxes } from "@/hooks/use-mailboxes";
import { AtIcon } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { paletteIcon } from "../registry/palette-icon";
import type { Command, CommandContext } from "../registry/types";

export function useAccountCommands(ctx: CommandContext): Command[] {
  const accounts = useMailboxes().data?.accounts ?? [];
  const router = useRouter();

  const matches = router.state.matches;
  const currentRouteId = ctx.currentRouteId;
  const routeSearch = router.state.location.search;
  const routeQuery =
    typeof routeSearch === "object" &&
    routeSearch !== null &&
    "q" in routeSearch &&
    typeof routeSearch.q === "string"
      ? routeSearch.q
      : undefined;
  const includeJunk =
    typeof routeSearch === "object" &&
    routeSearch !== null &&
    "includeJunk" in routeSearch &&
    routeSearch.includeJunk === true;
  const currentFolder = matches.find(
    (match) => match.routeId === "/_dashboard/$mailboxId/$folder/",
  )?.params.folder;
  const currentLabel = matches.find(
    (match) =>
      match.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/",
  )?.params.label;
  const folderView = isEmailView(currentFolder) ? currentFolder : undefined;
  const labelView: EmailView | undefined =
    currentLabel === "important" ? "important" : undefined;
  const isInboxRootRoute =
    currentRouteId === "/_dashboard/$mailboxId/inbox/" ||
    currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId";
  const currentMailboxView: EmailView | undefined =
    labelView ?? folderView ?? (isInboxRootRoute ? "inbox" : undefined);

  return useMemo(() => {
    if (ctx.activeMailboxId == null) return [];

    return accounts
      .filter(
        (
          account,
        ): account is typeof account & { mailboxId: number } =>
          account.mailboxId != null &&
          account.mailboxId !== ctx.activeMailboxId,
      )
      .map((account): Command => {
        const mailboxId = account.mailboxId;
        const displayEmail =
          getMailboxDisplayEmail(account) ?? "Account";

        return {
          id: `account:switch-${mailboxId}`,
          label: `Switch to ${displayEmail}`,
          icon: paletteIcon(AtIcon),
          group: "accounts",
          perform: (_ctx, services) => {
            if (
              currentRouteId ===
              "/_dashboard/$mailboxId/inbox/search"
            ) {
              services.navigate({
                to: "/$mailboxId/inbox/search",
                params: { mailboxId },
                search: {
                  q: routeQuery?.trim() ? routeQuery : undefined,
                  includeJunk: includeJunk ? true : undefined,
                },
              });
            } else if (
              currentRouteId ===
              "/_dashboard/$mailboxId/inbox/drafts"
            ) {
              services.navigate({
                to: "/$mailboxId/inbox/drafts",
                params: { mailboxId },
              });
            } else if (
              currentRouteId?.startsWith(
                "/_dashboard/$mailboxId/inbox",
              ) ||
              currentRouteId ===
                "/_dashboard/$mailboxId/$folder/" ||
              currentRouteId ===
                "/_dashboard/$mailboxId/$folder/email/$emailId"
            ) {
              if (
                currentLabel === "important" ||
                currentMailboxView === "important"
              ) {
                services.navigate({
                  to: "/$mailboxId/inbox/labels/$label",
                  params: {
                    mailboxId,
                    label: "important",
                  },
                });
              } else if (currentMailboxView === "inbox") {
                services.navigate({
                  to: "/$mailboxId/inbox",
                  params: { mailboxId },
                });
              } else if (currentMailboxView && isEmailFolderView(currentMailboxView)) {
                services.navigate({
                  to: "/$mailboxId/$folder",
                  params: {
                    mailboxId,
                    folder: currentMailboxView,
                  },
                });
              } else {
                services.navigate({
                  to: "/$mailboxId/inbox",
                  params: { mailboxId },
                });
              }
            } else {
              services.navigate({
                to: "/$mailboxId/inbox",
                params: { mailboxId },
              });
            }

            services.close();
          },
        };
      });
  }, [
    ctx.activeMailboxId,
    accounts,
    currentRouteId,
    currentLabel,
    currentMailboxView,
    routeQuery,
    includeJunk,
  ]);
}
