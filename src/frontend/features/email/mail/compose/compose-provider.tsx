import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { ComposeInitial } from "../types";
import { registerOpenComposeListener } from "./compose-events";
import { MailComposeContext } from "./compose-context";
import { ComposePanel } from "./compose-panel";

export function MailComposeProvider({ children }: { children: ReactNode }) {
 const router = useRouter();
 const [isOpen, setIsOpen] = useState(false);
 const [initial, setInitial] = useState<ComposeInitial | undefined>();
 const mailboxIdParam = router.state.matches.find(
 (match) => match.routeId === "/_dashboard/$mailboxId",
 )?.params.mailboxId;
 const activeMailboxId =
 mailboxIdParam != null ? Number(mailboxIdParam) : undefined;

 const openCompose = useCallback(
 (nextInitial?: ComposeInitial) => {
 const composeKey =
 nextInitial?.composeKey ??
 (nextInitial?.threadId
 ? `reply:${nextInitial.threadId}`
 : `new:${crypto.randomUUID()}`);
 setInitial({
 ...nextInitial,
 composeKey,
 mailboxId: nextInitial?.mailboxId ?? activeMailboxId,
 });
 setIsOpen(true);
 },
 [activeMailboxId],
 );

 const closeCompose = useCallback(() => {
 setIsOpen(false);
 setInitial(undefined);
 }, []);

 useEffect(
 () =>
 registerOpenComposeListener((nextInitial) => {
 openCompose(nextInitial);
 }),
 [openCompose],
 );

 const value = useMemo(
 () => ({ openCompose, closeCompose, isOpen, initial }),
 [openCompose, closeCompose, isOpen, initial],
 );

 return (
 <MailComposeContext.Provider value={value}>
 {children}
 <ComposePanel
 open={isOpen}
 initial={initial}
 onOpenChange={(open) => {
 if (!open) closeCompose();
 }}
 />
 </MailComposeContext.Provider>
 );
}
