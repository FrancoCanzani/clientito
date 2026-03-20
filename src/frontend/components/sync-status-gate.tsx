import { useSyncStatus } from "@/features/home/hooks/use-sync-status";
import { ApiError } from "@/features/home/queries";
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
    if (!(error instanceof ApiError) || error.status !== 401) {
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
      void navigate({ to: "/get-started", replace: true });
      return;
    }

    if (pathname === "/get-started" && status.state === "ready") {
      void navigate({ to: "/home", replace: true });
    }
  }, [navigate, pathname, status]);

  return null;
}
