import { fetchSyncStatus } from "@/features/home/queries";
import { queryOptions, useQuery } from "@tanstack/react-query";

const SYNC_ACTIVE_POLL_MS = 1_000;
const SYNC_IDLE_POLL_MS = 60_000;

export const syncStatusQueryOptions = queryOptions({
  queryKey: ["sync-status"] as const,
  queryFn: fetchSyncStatus,
  staleTime: 30_000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: (query) => {
    const status = query.state.data;
    if (!status) return SYNC_ACTIVE_POLL_MS;
    if (status.phase) return SYNC_ACTIVE_POLL_MS;
    return SYNC_IDLE_POLL_MS;
  },
});

export function useSyncStatus(options?: {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean | "always";
}) {
  return useQuery({
    ...syncStatusQueryOptions,
    ...options,
  });
}
