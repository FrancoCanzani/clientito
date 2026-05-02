import { isComposerOpen } from "@/features/email/mail/compose/compose-editor-ref";
import {
  isEmailView,
} from "@/features/email/mail/views";
import { getPreferredMailboxId } from "@/features/email/mail/utils/mailbox";
import { useFocusedEmail } from "@/hooks/use-focused-email";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import type { CommandContext } from "./types";

export function useCommandContext(): CommandContext {
  const router = useRouter();
  const isMobile = useIsMobile();
  const focused = useFocusedEmail();
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
  const labelView: string | undefined = currentLabel != null
    ? (currentLabel as string)
    : undefined;
  const isInboxRootRoute =
    currentRouteId === "/_dashboard/$mailboxId/inbox/" ||
    currentRouteId === "/_dashboard/$mailboxId/inbox/email/$emailId";
  const currentView: string | undefined =
    labelView ?? folderView ?? (isInboxRootRoute ? "inbox" : undefined);

  const selectedEmailId = focused?.id ?? null;
  const selectedEmail = focused
    ? {
        fromAddr: focused.fromAddr,
        fromName: focused.fromName,
        subject: focused.subject,
        threadId: focused.threadId,
        mailboxId: focused.mailboxId,
      }
    : null;

  return useMemo(
    () => ({
      currentRouteId,
      currentView,
      activeMailboxId,
      defaultMailboxId,
      selectedEmailId,
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
