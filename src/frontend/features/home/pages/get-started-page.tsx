import { Button } from "@/components/ui/button";
import { useSyncStatus } from "@/features/home/hooks/use-sync-status";
import {
  beginGmailConnection,
  runIncrementalSync,
  startFullSync,
} from "@/features/home/mutations";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  ShieldCheckIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

const IMPORT_OPTIONS = [
  { value: 6, label: "Last 6 months", description: "Quick start, recent emails only" },
  { value: 12, label: "Last year", description: "Good balance of history and speed" },
  { value: 0, label: "Everything", description: "Full archive, may take a while" },
] as const;

export default function GetStartedPage() {
  const queryClient = useQueryClient();
  const [selectedMonths, setSelectedMonths] = useState<number>(12);

  const syncStatusQuery = useSyncStatus({
    staleTime: 0,
    refetchOnMount: "always",
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
    mutationFn: async () =>
      startFullSync(selectedMonths || undefined, true),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
      await syncStatusQuery.refetch();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start Gmail sync.",
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

  const showConnect = status?.state === "needs_mailbox_connect";
  const showReconnect = status?.state === "needs_reconnect";
  const showStartSync = status?.state === "ready_to_sync";
  const showError = status?.state === "error";
  const showSyncing = status?.state === "syncing";

  const progressPercent =
    showSyncing &&
    typeof status?.progressCurrent === "number" &&
    typeof status?.progressTotal === "number" &&
    status.progressTotal > 0
      ? Math.min(
          Math.round((status.progressCurrent / status.progressTotal) * 100),
          100,
        )
      : null;

  const progressLabel =
    typeof status?.progressCurrent === "number"
      ? new Intl.NumberFormat().format(status.progressCurrent)
      : null;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-lg flex-col justify-center gap-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Clientito
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect your Gmail to get started
        </p>
      </div>

      {/* Step 1: Connect */}
      {(showConnect || showReconnect) && (
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border border-border/60 p-5">
            <div className="flex items-start gap-3">
              <EnvelopeSimpleIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Gmail access</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {showReconnect
                    ? "Your connection expired. Reconnect to resume syncing."
                    : "We'll import your inbox so you can search, take notes, and manage tasks from one place."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Private by default</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Your data stays yours. Nothing is sold or shared. Disconnect
                  anytime.
                </p>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => void reconnectMutation.mutateAsync()}
            disabled={reconnectMutation.isPending}
          >
            {reconnectMutation.isPending
              ? "Opening Google..."
              : showReconnect
                ? "Reconnect Gmail"
                : "Connect Gmail"}
            <ArrowRightIcon className="ml-1.5 size-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Choose import range */}
      {showStartSync && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm font-medium">
              How much email history should we import?
            </p>
          </div>

          <div className="space-y-2">
            {IMPORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedMonths(option.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  selectedMonths === option.value
                    ? "border-foreground bg-muted/50"
                    : "border-border/60 hover:border-border hover:bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    selectedMonths === option.value
                      ? "border-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {selectedMonths === option.value && (
                    <div className="size-2 rounded-full bg-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={() => void startSyncMutation.mutateAsync()}
            disabled={startSyncMutation.isPending}
          >
            {startSyncMutation.isPending
              ? "Starting..."
              : "Start import"}
            <ArrowRightIcon className="ml-1.5 size-4" />
          </Button>
        </div>
      )}

      {/* Step 3: Syncing */}
      {showSyncing && (
        <div className="space-y-6">
          <div className="space-y-4 text-center">
            <SpinnerGapIcon className="mx-auto size-8 animate-spin text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {status?.phase === "listing"
                  ? "Scanning your mailbox..."
                  : "Importing your emails..."}
              </p>
              {progressLabel && (
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {progressLabel}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}emails imported
                  </span>
                </p>
              )}
            </div>
          </div>

          {progressPercent !== null && (
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            This runs in the background. You can start using the app now.
          </p>

          <Button asChild variant="outline" className="w-full">
            <Link to="/inbox">
              Open inbox
              <ArrowRightIcon className="ml-1.5 size-4" />
            </Link>
          </Button>
        </div>
      )}

      {/* Error state */}
      {showError && (
        <div className="space-y-6">
          <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <p className="text-sm font-medium">Import needs attention</p>
            <p className="text-sm text-muted-foreground">
              Something went wrong during sync. You can retry or restart the
              import.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
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
                ? "Starting..."
                : retrySyncMutation.isPending
                  ? "Retrying..."
                  : needsFullResync || !status?.hasSynced
                    ? "Restart import"
                    : "Retry sync"}
            </Button>
            {status?.hasSynced && !needsFullResync && (
              <Button
                variant="outline"
                onClick={() => void startSyncMutation.mutateAsync()}
                disabled={
                  startSyncMutation.isPending || retrySyncMutation.isPending
                }
              >
                Full restart
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
