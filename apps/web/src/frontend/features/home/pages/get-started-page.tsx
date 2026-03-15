import { Button } from "@/components/ui/button";
import {
  beginGmailConnection,
  runIncrementalSync,
  startFullSync,
} from "@/features/home/mutations";
import { fetchSyncStatus } from "@/features/home/queries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShieldCheckIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function GetStartedPage() {
  const queryClient = useQueryClient();
  const syncStatusQuery = useQuery({
    queryKey: ["sync-status"],
    queryFn: fetchSyncStatus,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (query) => {
      const status = query.state.data;
      if (!status) return 1_000;
      if (status.phase) return 1_000;
      return false;
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async () => {
      beginGmailConnection();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Google connection failed.",
      );
    },
  });

  const startSyncMutation = useMutation({
    mutationFn: async () => startFullSync(12, true),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      await syncStatusQuery.refetch();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to start Gmail sync.",
      );
    },
  });

  const retrySyncMutation = useMutation({
    mutationFn: async () => runIncrementalSync(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      await syncStatusQuery.refetch();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to retry Gmail sync.",
      );
    },
  });

  const status = syncStatusQuery.data;
  const syncError = status?.state === "error" ? status.error : null;
  const needsFullResync =
    typeof syncError === "string" &&
    /history is too old|full sync again|full sync first/i.test(syncError);

  const phaseLabel =
    status?.phase === "listing"
      ? "Preparing your inbox"
      : status?.phase === "fetching"
        ? "Importing messages"
        : status?.phase === "syncing"
          ? "Syncing Gmail"
          : "Setting things up";

  const progressLabel =
    typeof status?.progressCurrent === "number"
      ? `${new Intl.NumberFormat().format(status.progressCurrent)} emails synced`
      : null;

  const showConnect = status?.state === "needs_mailbox_connect";
  const showReconnect = status?.state === "needs_reconnect";
  const showStartSync = status?.state === "ready_to_sync";
  const showError = status?.state === "error";
  const showSyncing = status?.state === "syncing";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-2xl flex-col justify-center gap-8">
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-tight text-muted-foreground">
          Get started
        </p>
        <h1 className="text-3xl font-medium tracking-tight text-foreground">
          Connect Gmail to use Clientito
        </h1>
        <p className="max-w-xl text-base leading-8 text-muted-foreground">
          Connect your mailbox once, then we import your inbox so search, notes,
          and tasks work from the same place.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-border/70 bg-background px-5 py-5">
        <div className="space-y-2">
          <h2 className="text-sm font-medium tracking-tight">Why connect Gmail</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            We use Gmail access to import your inbox, keep it in sync, and let
            you search and act on your messages inside the app.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium tracking-tight">Privacy</h2>
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            Your mailbox access is used only to power the product. Your data is
            not sold, and you can disconnect Google at any time.
          </p>
        </div>

        {showConnect ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign-in is complete. Connect Gmail access to import your inbox and
              use mailbox features inside the app.
            </p>
            <Button
              type="button"
              onClick={() => {
                void reconnectMutation.mutateAsync();
              }}
              disabled={reconnectMutation.isPending}
            >
              {reconnectMutation.isPending ? "Opening Google..." : "Connect Gmail"}
            </Button>
          </div>
        ) : null}

        {showReconnect ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your Gmail connection expired or was revoked. Reconnect to resume
              sync and inbox actions.
            </p>
            <Button
              type="button"
              onClick={() => {
                void reconnectMutation.mutateAsync();
              }}
              disabled={reconnectMutation.isPending}
            >
              {reconnectMutation.isPending ? "Opening Google..." : "Reconnect Gmail"}
            </Button>
          </div>
        ) : null}

        {showStartSync ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your account is connected. Start the first inbox import when you’re
              ready.
            </p>
            <Button
              type="button"
              onClick={() => {
                void startSyncMutation.mutateAsync();
              }}
              disabled={startSyncMutation.isPending}
            >
              {startSyncMutation.isPending ? "Starting import..." : "Start inbox import"}
            </Button>
          </div>
        ) : null}

        {showSyncing ? (
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-tight">{phaseLabel}</p>
            <p className="text-sm text-muted-foreground">
              {progressLabel
                ? progressLabel
                : "This can take a few minutes on the first run."}
            </p>
            <div>
              <Button asChild type="button" variant="outline">
                <Link to="/inbox">Open inbox while importing</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {showError ? (
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-tight">
              Sync needs attention
            </p>
            <p className="text-sm text-muted-foreground">
              {syncError ??
                "We hit a Gmail sync issue. Retry to catch up, or restart the inbox import if the sync history expired."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => {
                  if (needsFullResync || !status?.hasSynced) {
                    void startSyncMutation.mutateAsync();
                    return;
                  }

                  void retrySyncMutation.mutateAsync();
                }}
                disabled={
                  startSyncMutation.isPending || retrySyncMutation.isPending
                }
              >
                {startSyncMutation.isPending
                  ? "Starting import..."
                  : retrySyncMutation.isPending
                    ? "Retrying sync..."
                    : needsFullResync || !status?.hasSynced
                      ? "Restart inbox import"
                      : "Retry sync"}
              </Button>
              {status?.hasSynced && !needsFullResync ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void startSyncMutation.mutateAsync();
                  }}
                  disabled={
                    startSyncMutation.isPending || retrySyncMutation.isPending
                  }
                >
                  Restart inbox import
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
