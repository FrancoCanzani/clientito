import { isComposerOpen } from "@/features/email/inbox/components/compose/compose-editor-ref";
import {
  isEmailView,
  type EmailView,
} from "@/features/email/inbox/utils/inbox-filters";
import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePageContext } from "@/hooks/use-page-context";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import type { CommandContext } from "./types";

export function useCommandContext(): CommandContext {
  const router = useRouter();
  const isMobile = useIsMobile();
  const pageContext = usePageContext();
  const accounts = useMailboxes().data?.accounts ?? [];

  const matches = router.state.matches;
  const currentRouteId = matches[matches.length - 1]?.routeId ?? "";

  const activeMailboxParam = matches.find(
    (match) => match.routeId === "/_dashboard/$mailboxId",
  )?.params.mailboxId;
  const activeMailboxId =
    activeMailboxParam != null ? Number(activeMailboxParam) : null;
  const defaultMailboxId =
    activeMailboxId ?? getPreferredMailboxId(accounts);

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
  const currentView: string | undefined =
    labelView ?? folderView ?? (isInboxRootRoute ? "inbox" : undefined);

  const emailEntity =
    pageContext?.entity?.type === "email" ? pageContext.entity : null;
  const selectedEmailId = emailEntity?.id ?? null;
  const selectedEmailIsArchived = null;
  const selectedEmailIsRead = null;
  const selectedEmail = emailEntity
    ? {
        fromAddr: emailEntity.fromAddr,
        fromName: emailEntity.fromName ?? null,
        subject: emailEntity.subject ?? null,
        threadId: emailEntity.threadId ?? null,
        mailboxId: emailEntity.mailboxId ?? null,
      }
    : null;

  return useMemo(
    () => ({
      currentRouteId,
      currentView,
      activeMailboxId,
      defaultMailboxId,
      selectedEmailId,
      selectedEmailIsArchived,
      selectedEmailIsRead,
      selectedEmail,
      composerOpen: isComposerOpen(),
      isMobile,
    }),
    [
      currentRouteId,
      currentView,
      activeMailboxId,
      defaultMailboxId,
      selectedEmailId,
      selectedEmail,
      isMobile,
    ],
  );
}
