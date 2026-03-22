import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSyncStatus } from "@/features/home/hooks/use-sync-status";
import {
  beginGmailConnection,
  runIncrementalSync,
  startFullSync,
} from "@/features/home/mutations";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRightIcon,
  EnvelopeSimpleIcon,
  ShieldCheckIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

const IMPORT_OPTIONS = [
  {
    value: 6,
    label: "Last 6 months",
    description: "Quick start, recent emails only",
  },
  {
    value: 12,
    label: "Last year",
    description: "Good balance of history and speed",
  },
  {
    value: 0,
    label: "Everything",
    description: "Full archive, may take a while",
  },
];

export default function GetStartedPage() {
  const queryClient = useQueryClient();
  const [selectedMonths, setSelectedMonths] = useState<number>(12);
  const { user } = useAuth();

  const syncStatusQuery = useSyncStatus({
    staleTime: 0,
    refetchOnMount: "always",
  });

  const reconnectMutation = useMutation({
    mutationFn: async () => {
      return beginGmailConnection("/get-started");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Google connection failed.",
      );
    },
  });

  const startSyncMutation = useMutation({
    mutationFn: async () => startFullSync(selectedMonths || undefined),
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
        error instanceof Error ? error.message : "Failed to retry Gmail sync.",
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
    <div className="mx-auto flex-1 flex flex-col items-center justify-center gap-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-medium">
          Welcome {user?.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect your Gmail to get started
        </p>
      </div>

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

      {showStartSync && (
        <div className="space-y-10">
          <div className="text-center">
            <p className="text-sm font-medium">
              How much email history should we import?
            </p>
          </div>

          <RadioGroup
            value={String(selectedMonths)}
            onValueChange={(value) => setSelectedMonths(Number(value))}
            className="space-y-2"
          >
            {IMPORT_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center gap-3">
                <RadioGroupItem
                  value={String(option.value)}
                  id={String(option.value)}
                />
                <Label htmlFor={String(option.value)}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>

          <Button
            className="w-full"
            onClick={() => void startSyncMutation.mutateAsync()}
            disabled={startSyncMutation.isPending}
          >
            {startSyncMutation.isPending ? "Starting..." : "Start import"}
          </Button>
        </div>
      )}

      {showSyncing && (
        <div className="space-y-10">
          <div className="space-y-4 text-center">
            <SpinnerGapIcon className="mx-auto size-5 animate-spin text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {status?.phase === "listing"
                  ? "Scanning your mailbox..."
                  : "Importing your emails..."}
              </p>
              {progressLabel && (
                <p className="text-sm font-medium tabular-nums tracking-tight">
                  {progressLabel}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    emails imported
                  </span>
                </p>
              )}
            </div>
          </div>

          {progressPercent !== null && (
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-xl bg-foreground transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            This runs in the background. You can start using the app now.
          </p>

          <Button asChild className="w-full">
            <Link to="/inbox/$id" params={{ id: "all" }}>Go to inbox</Link>
          </Button>
        </div>
      )}

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
