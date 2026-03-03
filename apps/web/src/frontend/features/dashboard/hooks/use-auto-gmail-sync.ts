import {
  type SyncStatus,
  fetchSyncStatus,
  startFullSync,
} from "@/features/dashboard/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const TOAST_ID = "gmail-sync-progress";
const AUTO_START_QUERY_KEY = ["sync-start-auto"] as const;

function showSyncProgressToast(status: SyncStatus) {
  if (status.error) {
    toast.error(status.error, { id: TOAST_ID });
    return;
  }

  if (status.phase) {
    const current = status.progressCurrent ?? 0;
    const total = status.progressTotal ?? 0;
    const progressText =
      total > 0 ? `${current}/${total}` : current > 0 ? `${current}` : "0";

    toast.loading(`Syncing Gmail (${status.phase}, ${progressText})`, {
      id: TOAST_ID,
    });
    return;
  }
}

export function useAutoGmailSync() {
  const queryClient = useQueryClient();
  const previousStatusRef = useRef<SyncStatus | null>(null);

  const syncStatusQuery = useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      try {
        return await fetchSyncStatus();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch sync status.";
        toast.error(message, { id: TOAST_ID });
        throw error;
      }
    },
    refetchInterval: (query) => {
      const status = query.state.data;
      if (!status) return 1_000;
      if (status.error) return false;
      if (status.phase) return 1_000;
      if (!status.hasSynced) return 1_000;
      return false;
    },
  });

  useEffect(() => {
    const status = syncStatusQuery.data;
    if (!status) return;

    const previous = previousStatusRef.current;
    previousStatusRef.current = status;

    showSyncProgressToast(status);

    const wasSyncing = Boolean(previous?.phase);
    const isSyncing = Boolean(status.phase);
    const completedTransition =
      wasSyncing && !isSyncing && !status.error && status.hasSynced;

    if (completedTransition) {
      toast.success("Gmail sync complete", { id: TOAST_ID });
    }
  }, [syncStatusQuery.data]);

  const shouldAutoStart =
    Boolean(syncStatusQuery.data) &&
    !syncStatusQuery.data?.hasSynced &&
    !syncStatusQuery.data?.phase &&
    !syncStatusQuery.data?.error &&
    !syncStatusQuery.data?.needsGoogleReconnect;

  useQuery({
    queryKey: AUTO_START_QUERY_KEY,
    queryFn: async () => {
      try {
        await startFullSync(12, true);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to start Gmail sync.";
        toast.error(message, { id: TOAST_ID });
        throw error;
      }

      toast.loading("Syncing Gmail in background", { id: TOAST_ID });
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      return true;
    },
    enabled: shouldAutoStart,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
