import { getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  fetchSyncStatus,
  startFullSync,
  runIncrementalSync,
  type SyncStatus,
} from "@/features/dashboard/api";
import { fetchCustomers } from "@/features/customers/api";

const orgRoute = getRouteApi("/_dashboard/$orgId");

function SyncProgress({ status }: { status: SyncStatus }) {
  const { phase, progressCurrent, progressTotal } = status;

  const label = (() => {
    switch (phase) {
      case "listing":
        return `Finding emails${progressCurrent ? ` (${progressCurrent} found)` : ""}...`;
      case "fetching":
        return progressTotal
          ? `Fetching emails (${progressCurrent ?? 0} / ${progressTotal})...`
          : "Fetching emails...";
      case "syncing":
        return "Checking for new emails...";
      default:
        return "Syncing...";
    }
  })();

  const pct =
    phase === "fetching" && progressTotal && progressTotal > 0
      ? Math.round(((progressCurrent ?? 0) / progressTotal) * 100)
      : null;

  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded bg-primary" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {pct !== null && (
          <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
            <div
              className="h-full rounded bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          This runs in the background. You can leave this page.
        </p>
      </CardContent>
    </Card>
  );
}

function CustomerRow({
  customer,
}: {
  customer: {
    id: string;
    name: string;
    company: string | null;
    email: string;
    emailCount: number;
    pendingRemindersCount: number;
  };
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{customer.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {customer.company ? `${customer.company} · ` : null}
          {customer.email}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {customer.emailCount} emails
        </Badge>
        {customer.pendingRemindersCount > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {customer.pendingRemindersCount}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function DashboardHomePage() {
  const { organization, orgId } = orgRoute.useLoaderData();
  const queryClient = useQueryClient();

  const syncStatus = useQuery({
    queryKey: ["sync-status", orgId],
    queryFn: () => fetchSyncStatus(orgId),
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      if (phase && phase !== "error") return 2000;
      return false;
    },
  });

  const isSyncRunning =
    syncStatus.data?.phase != null && syncStatus.data.phase !== "error";
  const hasSynced = syncStatus.data?.hasSynced === true;
  const hasHistoryId = Boolean(syncStatus.data?.historyId);

  const customers = useQuery({
    queryKey: ["customers", orgId],
    queryFn: () => fetchCustomers(orgId, { limit: 5 }),
    enabled: hasSynced && !isSyncRunning,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["sync-status", orgId] });
    queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
  }

  const [selectedMonths, setSelectedMonths] = useState<number | undefined>(12);

  const fullSync = useMutation({
    mutationFn: (months?: number) => startFullSync(orgId, months),
    onSuccess: invalidateAll,
  });

  const incrementalSync = useMutation({
    mutationFn: () => runIncrementalSync(orgId),
    onSuccess: invalidateAll,
  });

  function handleSync() {
    if (hasHistoryId) {
      incrementalSync.mutate();
    } else {
      fullSync.mutate(selectedMonths);
    }
  }

  const syncError =
    syncStatus.data?.error ??
    (fullSync.error instanceof Error ? fullSync.error.message : null) ??
    (incrementalSync.error instanceof Error ? incrementalSync.error.message : null);

  if (syncStatus.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-lg font-medium">{organization.name}</h2>

      {!hasSynced && !isSyncRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connect your Gmail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pull your emails to find and manage your customers.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { label: "6 months", value: 6 },
                { label: "1 year", value: 12 },
                { label: "3 years", value: 36 },
                { label: "Everything", value: undefined },
              ] as const).map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setSelectedMonths(opt.value)}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                    selectedMonths === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={fullSync.isPending}
            >
              {fullSync.isPending ? "Starting..." : "Sync Gmail"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isSyncRunning && syncStatus.data && (
        <SyncProgress status={syncStatus.data} />
      )}

      {hasSynced && !isSyncRunning && (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-muted-foreground">
                {syncStatus.data?.lastSync
                  ? `Last sync: ${new Date(syncStatus.data.lastSync).toLocaleString()}`
                  : null}
              </span>
              {syncStatus.data?.lastSync && (
                <p className="text-xs text-muted-foreground">
                  Next sync: {new Date(syncStatus.data.lastSync + 5 * 60_000).toLocaleTimeString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={incrementalSync.isPending}
            >
              {incrementalSync.isPending ? "Starting..." : "Sync now"}
            </Button>
          </div>

          {customers.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customers.data && customers.data.data.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Customers ({customers.data.pagination.total})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {customers.data.data.map((c) => (
                    <CustomerRow key={c.id} customer={c} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-6 text-center text-xs text-muted-foreground">
                No customers found yet. Try syncing more emails or add one manually.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {syncError && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-destructive">{syncError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleSync}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
