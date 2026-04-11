import {
  isEmailView,
  type EmailView,
} from "@/features/email/inbox/utils/inbox-filters";

export function resolveCurrentView(
  currentRouteId: string,
  matches: Array<{ routeId: string; params: Record<string, unknown> }>,
): {
  currentView: EmailView | undefined;
  currentLabel: string | undefined;
} {
  const rawFolder = matches.find(
    (m) => m.routeId === "/_dashboard/$mailboxId/$folder/",
  )?.params.folder;
  const currentFolder = typeof rawFolder === "string" ? rawFolder : undefined;
  const rawLabel = matches.find(
    (m) => m.routeId === "/_dashboard/$mailboxId/inbox/labels/$label/",
  )?.params.label;
  const currentLabel = typeof rawLabel === "string" ? rawLabel : undefined;

  const folderView = isEmailView(currentFolder) ? currentFolder : undefined;
  const labelView: EmailView | undefined =
    currentLabel === "important" ? "important" : undefined;
  const isInboxRoot =
    currentRouteId === "/_dashboard/$mailboxId/inbox/" ||
    currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId";
  const currentView: EmailView | undefined =
    labelView ?? folderView ?? (isInboxRoot ? "inbox" : undefined);

  return { currentView, currentLabel };
}
