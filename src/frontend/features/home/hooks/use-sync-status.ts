import { fetchSyncStatus } from "@/features/home/queries";
import { queryOptions, useQuery } from "@tanstack/react-query";

export const syncStatusQueryOptions = queryOptions({
  queryKey: ["sync-status"] as const,
  queryFn: fetchSyncStatus,
  staleTime: 30 * 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: (query) => {
    const status = query.state.data;
    if (!status) return 1_000;
    if (status.phase) return 1_000;
    return false;
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
