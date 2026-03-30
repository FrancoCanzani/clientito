import { useSyncStatus } from "@/features/home/hooks/use-sync-status";
import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

export function SyncStatusGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const syncStatusQuery = useSyncStatus();
  const status = syncStatusQuery.data;
  const error = syncStatusQuery.error;

  useEffect(() => {
    if (!error || typeof error !== "object" || !("status" in error) || error.status !== 401) {
      return;
    }

    navigate({ to: "/login", replace: true });
  }, [error, navigate]);

  useEffect(() => {
    if (!status) return;

    if (
      status.state === "needs_mailbox_connect" ||
      status.state === "needs_reconnect" ||
      status.state === "ready_to_sync"
    ) {
      if (pathname === "/get-started") return;
      navigate({ to: "/get-started", replace: true });
      return;
    }
  }, [navigate, pathname, status]);

  return null;
}
