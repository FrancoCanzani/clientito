import {
  VIEW_VALUES,
  type EmailView,
} from "@/features/email/inbox/utils/inbox-filters";

export function resolveCurrentView(
  currentRouteId: string,
  matches: Array<{ routeId: string; params: Record<string, unknown> }>,
): {
  currentView: EmailView | undefined;
  currentLabel: string | undefined;
} {
  const currentFolder = matches.find(
    (m) => m.routeId === "/_dashboard/$mailboxId/$folder/",
  )?.params.folder as string | undefined;
  const currentLabel = matches.find(
    (m) => m.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/",
  )?.params.label as string | undefined;

  const folderView = VIEW_VALUES.includes(currentFolder as EmailView)
    ? (currentFolder as EmailView)
    : undefined;
  const labelView = currentLabel === "important" ? ("important" as const) : undefined;
  const isInboxRoot =
    currentRouteId === "/_dashboard/$mailboxId/inbox/" ||
    currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId";
  const currentView: EmailView | undefined =
    labelView ?? folderView ?? (isInboxRoot ? "inbox" : undefined);

  return { currentView, currentLabel };
}
