import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { useSyncStatus } from "@/features/onboarding/hooks/use-sync-status";
import {
  beginGmailConnection,
  runIncrementalSync,
  startFullSync,
} from "@/features/onboarding/mutations";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const [selectedMonths, setSelectedMonths] = useState<number>(12);
  const { user } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const preferredMailboxId = getPreferredMailboxId(accounts);

  const syncStatusQuery = useSyncStatus({
    staleTime: 0,
    refetchOnMount: "always",
  });

  const isSyncDone = syncStatusQuery.data?.state === "ready";

  const onSyncSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    await syncStatusQuery.refetch();
  };
  const onMutationError = (error: Error) => {
    toast.error(error.message || "Something went wrong.");
  };

  const reconnectMutation = useMutation({
    mutationFn: () => beginGmailConnection("/get-started"),
    onError: onMutationError,
  });

  const startSyncMutation = useMutation({
    mutationFn: () => startFullSync(selectedMonths || undefined),
    onSuccess: onSyncSuccess,
    onError: onMutationError,
  });

  const retrySyncMutation = useMutation({
    mutationFn: () => runIncrementalSync(),
    onSuccess: onSyncSuccess,
    onError: onMutationError,
  });

  const status = syncStatusQuery.data;
  const syncError = status?.state === "error" ? status.error : null;
  const needsFullResync =
    typeof syncError === "string" &&
    /history is too old|full sync again|full sync first/i.test(syncError);

  const state = status?.state;

  return (
    <div className="mx-auto h-dvh flex-1 flex flex-col items-center justify-center gap-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-medium">
          Welcome {user?.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose how much email to import
        </p>
      </div>

      {state === "needs_reconnect" && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Your connection expired. Reconnect to resume syncing.
          </p>
          <Button
            onClick={() => reconnectMutation.mutate()}
            disabled={reconnectMutation.isPending}
          >
            {reconnectMutation.isPending
              ? "Opening Google..."
              : "Reconnect Gmail"}
          </Button>
        </div>
      )}

      {(state === "ready_to_sync" || state === "needs_mailbox_connect") && (
        <div className="space-y-10">
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
            onClick={() => startSyncMutation.mutate()}
            disabled={startSyncMutation.isPending}
          >
            {startSyncMutation.isPending ? "Starting..." : "Start import"}
          </Button>
        </div>
      )}

      {(state === "syncing" || isSyncDone) && (
        <div className="space-y-6 text-center">
          {state === "syncing" && (
            <>
              <SpinnerGapIcon className="mx-auto size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {status?.progressCurrent && status?.progressTotal
                  ? `Syncing ${status.progressCurrent} of ${status.progressTotal} messages...`
                  : "Setting things up..."}
              </p>
            </>
          )}
          {isSyncDone && (
            <p className="text-sm text-muted-foreground">
              Your inbox is ready.
            </p>
          )}
          <Button
            variant={isSyncDone ? "default" : "outline"}
            onClick={() => {
              if (!preferredMailboxId) return;
              navigate({
                to: "/$mailboxId/inbox",
                params: { mailboxId: preferredMailboxId },
              });
            }}
            disabled={!preferredMailboxId}
          >
            Go to inbox
          </Button>
        </div>
      )}

      {state === "error" && (
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
                  startSyncMutation.mutate();
                  return;
                }
                retrySyncMutation.mutate();
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
                onClick={() => startSyncMutation.mutate()}
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
