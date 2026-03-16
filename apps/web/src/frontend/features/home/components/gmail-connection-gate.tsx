import { ApiError, fetchSyncStatus } from "@/features/home/queries";
import { runIncrementalSync } from "@/features/home/mutations";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

const AUTO_INCREMENTAL_SYNC_STALE_MS = 60_000;
const AUTO_INCREMENTAL_SYNC_COOLDOWN_MS = 30_000;

export function GmailConnectionGate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const lastAutoSyncAttemptAtRef = useRef(0);

  const autoSyncMutation = useMutation({
    mutationFn: runIncrementalSync,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      await syncStatusQuery.refetch();
    },
  });

  const maybeStartCatchUpSync = useCallback(() => {
    if (!status || status.state !== "ready" || !status.hasSynced) {
      return;
    }

    const now = Date.now();
    const lastSync = status.lastSync ?? 0;
    const syncIsFresh = lastSync > 0 && now - lastSync < AUTO_INCREMENTAL_SYNC_STALE_MS;
    const inCooldown =
      now - lastAutoSyncAttemptAtRef.current < AUTO_INCREMENTAL_SYNC_COOLDOWN_MS;

    if (syncIsFresh || inCooldown || autoSyncMutation.isPending) {
      return;
    }

    lastAutoSyncAttemptAtRef.current = now;
    void autoSyncMutation.mutateAsync().catch(() => {});
  }, [autoSyncMutation, status]);

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

  useEffect(() => {
    maybeStartCatchUpSync();
  }, [maybeStartCatchUpSync]);

  useEffect(() => {
    const handleWindowFocus = () => {
      maybeStartCatchUpSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      maybeStartCatchUpSync();
    };

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [maybeStartCatchUpSync]);

  return null;
}
