import { runDeltaSync } from "@/features/email/mail/queries";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const VISIBLE_POLL_INTERVAL_MS = 60_000;

export function useDeltaSync() {
 const { mailboxId: rawMailboxId } = mailboxRoute.useParams();
 const mailboxId = Number(rawMailboxId);

 useEffect(() => {
 if (!Number.isFinite(mailboxId) || mailboxId <= 0) return;

 const trigger = () => {
 if (document.hidden) return;
 void runDeltaSync(mailboxId);
 };

 trigger();
 window.addEventListener("focus", trigger);
 document.addEventListener("visibilitychange", trigger);
 const interval = window.setInterval(trigger, VISIBLE_POLL_INTERVAL_MS);

 return () => {
 window.removeEventListener("focus", trigger);
 document.removeEventListener("visibilitychange", trigger);
 window.clearInterval(interval);
 };
 }, [mailboxId]);
}
