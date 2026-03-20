import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  runIncrementalSync,
  startFullSync,
} from "@/features/home/mutations";
import { useSyncStatus } from "@/features/home/hooks/use-sync-status";
import { deleteAccount } from "@/features/settings/mutations";
import {
  fetchSignature,
  updateSignature,
} from "@/features/settings/signature-queries";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  ArrowClockwiseIcon,
  FloppyDiskIcon,
  MonitorIcon,
  MoonIcon,
  PencilSimpleIcon,
  SpinnerGapIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function formatLastSync(timestamp: number | null): string {
  if (!timestamp) return "Never";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [confirmText, setConfirmText] = useState("");

  const syncStatus = useSyncStatus();
  const status = syncStatus.data;
  const isSyncing = status?.state === "syncing";

  const incrementalSyncMutation = useMutation({
    mutationFn: runIncrementalSync,
    onSuccess: async () => {
      toast.success("Sync started");
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: () => toast.error("Failed to start sync"),
  });

  const fullSyncMutation = useMutation({
    mutationFn: () => startFullSync(undefined, true),
    onSuccess: async () => {
      toast.success("Full re-import started");
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: () => toast.error("Failed to start re-import"),
  });

  const signatureQuery = useQuery({
    queryKey: ["signature"],
    queryFn: fetchSignature,
  });

  const [signatureText, setSignatureText] = useState("");
  const [signatureDirty, setSignatureDirty] = useState(false);

  useEffect(() => {
    if (signatureQuery.data && !signatureDirty) {
      setSignatureText(signatureQuery.data.signature ?? "");
    }
  }, [signatureQuery.data, signatureDirty]);

  const signatureMutation = useMutation({
    mutationFn: () =>
      updateSignature(signatureText.trim().length > 0 ? signatureText.trim() : null),
    onSuccess: async () => {
      toast.success("Signature saved");
      setSignatureDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["signature"] });
    },
    onError: () => toast.error("Failed to save signature"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success("Account deleted");
      navigate({ to: "/login" });
    },
    onError: (error) => toast.error(error.message),
  });

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: SunIcon },
    { value: "dark" as const, label: "Dark", icon: MoonIcon },
    { value: "system" as const, label: "System", icon: MonitorIcon },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-xl font-medium tracking-tight">Settings</h1>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Account
        </h2>
        <div className="space-y-2 rounded-lg border border-border p-4">
          <div className="flex items-baseline gap-2 text-sm">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">
              Name
            </span>
            <span>{user?.name ?? "—"}</span>
          </div>
          <div className="flex items-baseline gap-2 text-sm">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">
              Email
            </span>
            <span>{user?.email ?? "—"}</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Gmail Sync
        </h2>
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {isSyncing ? "Syncing..." : "Last synced"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isSyncing && status?.progressCurrent
                  ? `${new Intl.NumberFormat().format(status.progressCurrent)} emails processed`
                  : formatLastSync(status?.lastSync ?? null)}
              </p>
            </div>
            {isSyncing ? (
              <SpinnerGapIcon className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => incrementalSyncMutation.mutate()}
                disabled={incrementalSyncMutation.isPending}
              >
                <ArrowClockwiseIcon className="mr-1.5 size-3.5" />
                Sync now
              </Button>
            )}
          </div>
          <div className="border-t border-border/50 pt-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm">Full re-import</p>
                <p className="text-xs text-muted-foreground">
                  Re-download all emails from Gmail
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fullSyncMutation.mutate()}
                disabled={fullSyncMutation.isPending || isSyncing}
              >
                {fullSyncMutation.isPending ? "Starting..." : "Re-import"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Appearance
        </h2>
        <div className="flex gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                theme === option.value
                  ? "border-foreground bg-foreground/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <option.icon className="size-4" />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <PencilSimpleIcon className="mr-1 inline size-3.5" />
          Email Signature
        </h2>
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">
            This signature will be appended to all outgoing emails.
          </p>
          <Textarea
            placeholder="Enter your email signature..."
            value={signatureText}
            onChange={(e) => {
              setSignatureText(e.target.value);
              setSignatureDirty(true);
            }}
            className="min-h-24"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => signatureMutation.mutate()}
              disabled={!signatureDirty || signatureMutation.isPending}
            >
              <FloppyDiskIcon className="mr-1.5 size-3.5" />
              {signatureMutation.isPending ? "Saving..." : "Save signature"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-destructive">
          Danger zone
        </h2>
        <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          <div className="flex items-center gap-3">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className="max-w-xs text-sm"
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={confirmText !== "DELETE" || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete account"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
