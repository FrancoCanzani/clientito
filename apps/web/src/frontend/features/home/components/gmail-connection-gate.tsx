import { ApiError, fetchSyncStatus } from "@/features/home/queries";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

export function GmailConnectionGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const syncStatusQuery = useQuery({
    queryKey: ["sync-status"],
    queryFn: fetchSyncStatus,
    staleTime: 30 * 1000,
    refetchInterval: (query) => {
      const status = query.state.data;
      if (!status) return 1_000;
      if (status.phase) return 1_000;
      return false;
    },
  });
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
      status.state === "error" ||
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
