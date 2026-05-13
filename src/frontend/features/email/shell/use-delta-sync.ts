import { runDeltaSync } from "@/features/email/mail/data/view-sync";
import { deviceCapabilities } from "@/lib/device-capabilities";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

// Refocus + visibilitychange + interval can all fire within ms of each other;
// without a floor we stack two concurrent sync passes through the worker queue.
const MIN_SYNC_SPACING_MS = 2000;

export function useDeltaSync() {
  const { mailboxId: rawMailboxId } = mailboxRoute.useParams();
  const mailboxId = Number(rawMailboxId);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(mailboxId) || mailboxId <= 0) return;

    const trigger = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastSyncAtRef.current < MIN_SYNC_SPACING_MS) return;
      lastSyncAtRef.current = now;
      void runDeltaSync(mailboxId);
    };

    trigger();
    window.addEventListener("focus", trigger);
    document.addEventListener("visibilitychange", trigger);
    const interval = window.setInterval(
      trigger,
      deviceCapabilities.deltaSyncIntervalMs,
    );

    return () => {
      window.removeEventListener("focus", trigger);
      document.removeEventListener("visibilitychange", trigger);
      window.clearInterval(interval);
    };
  }, [mailboxId]);
}