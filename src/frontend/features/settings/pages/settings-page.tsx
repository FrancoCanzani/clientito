import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import {
  beginGmailConnection,
  runIncrementalSync,
  startFullSync,
} from "@/features/home/mutations";
import { useSyncStatus } from "@/features/home/hooks/use-sync-status";
import {
  deleteAccount,
  updateSyncPreference,
} from "@/features/settings/mutations";
import { fetchSyncPreference } from "@/features/settings/queries";
import { useAuth } from "@/hooks/use-auth";
import {
  getMailboxDisplayEmail,
  useMailboxes,
  removeAccount,
  type MailboxAccount,
} from "@/hooks/use-mailboxes";
import { useTheme } from "@/hooks/use-theme";
import {
  ArrowClockwiseIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SpinnerGapIcon,
  SunIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
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

function formatImportHistoryHint(
  months: 6 | 12 | null,
  cutoffAt: number | null,
): string {
  if (months === null || cutoffAt === null) {
    return "No cutoff. Petit can import your full mailbox.";
  }

  const date = new Date(cutoffAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `Hard limit set to ${months === 6 ? "the last 6 months" : "the last year"} from ${date}.`;
}

function SettingsSection({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2
          className={
            danger
              ? "text-[11px] font-medium uppercase tracking-[0.18em] text-destructive"
              : "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
          }
        >
          {title}
        </h2>
        {description ? (
          <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SettingsRow({
  label,
  hint,
  children,
  alignTop = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div
      className={
        alignTop
          ? "flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
          : "flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="min-w-0 sm:max-w-[60%]">{children}</div>
    </div>
  );
}

function ConnectedAccountRow({
  account,
  canRemove,
  onRemove,
  onSync,
  isSyncing,
}: {
  account: MailboxAccount;
  canRemove: boolean;
  onRemove: (accountId: string) => void;
  onSync: (mailboxId: number) => void;
  isSyncing: boolean;
}) {
  const authOk = account.authState === "ok";
  const statusText = isSyncing
    ? "Syncing..."
    : account.hasSynced
      ? account.lastSync
        ? `Synced ${formatLastSync(account.lastSync)}`
        : "Synced"
      : "Not synced";

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">
          {getMailboxDisplayEmail(account) ?? "Unknown account"}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-block size-1.5 rounded-full ${authOk ? "bg-green-500" : "bg-amber-500"}`}
          />
          {statusText}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {account.mailboxId != null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSync(account.mailboxId!)}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <SpinnerGapIcon className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <ArrowClockwiseIcon className="size-3.5 text-muted-foreground" />
            )}
          </Button>
        )}
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(account.accountId)}
          >
            <TrashIcon className="size-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [confirmText, setConfirmText] = useState("");

  const syncStatus = useSyncStatus();
  const accountsQuery = useMailboxes();
  const accounts = accountsQuery.data?.accounts ?? [];

  const addAccountMutation = useMutation({
    mutationFn: () => beginGmailConnection("/settings"),
    onError: () => toast.error("Failed to connect Gmail account"),
  });

  const removeAccountMutation = useMutation({
    mutationFn: removeAccount,
    onSuccess: async () => {
      toast.success("Account removed");
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const [syncingMailboxId, setSyncingMailboxId] = useState<number | null>(null);
  const perAccountSyncMutation = useMutation({
    mutationFn: async (mailboxId: number) => {
      setSyncingMailboxId(mailboxId);
      await startFullSync(undefined, mailboxId);
    },
    onSuccess: async () => {
      toast.success("Sync started");
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: () => toast.error("Failed to start sync"),
    onSettled: () => setSyncingMailboxId(null),
  });
  const syncPreferenceQuery = useQuery({
    queryKey: ["sync-preference"],
    queryFn: fetchSyncPreference,
  });
  const status = syncStatus.data;
  const isSyncing = status?.state === "syncing";
  const syncPreference = syncPreferenceQuery.data;
  const selectedSyncMonths = syncPreference?.months ?? null;

  const incrementalSyncMutation = useMutation({
    mutationFn: () => runIncrementalSync(),
    onSuccess: async () => {
      toast.success("Sync started");
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: () => toast.error("Failed to start sync"),
  });

  const fullSyncMutation = useMutation({
    mutationFn: () => startFullSync(),
    onSuccess: async () => {
      toast.success("Full re-import started");
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: () => toast.error("Failed to start re-import"),
  });

  const syncPreferenceMutation = useMutation({
    mutationFn: updateSyncPreference,
    onSuccess: async (result, months) => {
      await queryClient.invalidateQueries({ queryKey: ["sync-preference"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });

      if (result.requiresBackfill) {
        try {
          await startFullSync();
          toast.success(
            months === null
              ? "Import history updated. Full mailbox backfill started."
              : "Import history updated. Backfill started.",
          );
          await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
          return;
        } catch {
          toast.success("Import history updated");
          return;
        }
      }

      toast.success("Import history updated");
    },
    onError: (error) => toast.error(error.message),
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
  const syncWindowOptions = [
    { value: 6 as const, label: "6 months" },
    { value: 12 as const, label: "1 year" },
    { value: null, label: "Everything" },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <PageHeader title="Settings" />

      <SettingsSection title="Account">
        <div className="border-t border-border/60">
          <SettingsRow label="Name">
            <p className="text-sm text-foreground sm:text-right">
              {user?.name ?? "—"}
            </p>
          </SettingsRow>
          <div className="border-t border-border/60" />
          <SettingsRow label="Email">
            <p className="truncate text-sm text-foreground sm:text-right">
              {user?.email ?? "—"}
            </p>
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Connected accounts"
        description="Manage your linked Gmail accounts."
      >
        <div className="border-t border-border/60">
          {accounts.map((acct) => (
            <div key={acct.accountId}>
              <ConnectedAccountRow
                account={acct}
                canRemove={accounts.length > 1}
                onRemove={(id) => removeAccountMutation.mutate(id)}
                onSync={(id) => perAccountSyncMutation.mutate(id)}
                isSyncing={isSyncing || syncingMailboxId === acct.mailboxId}
              />
              <div className="border-t border-border/60" />
            </div>
          ))}
          <div className="py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addAccountMutation.mutate()}
              disabled={addAccountMutation.isPending}
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              Add Gmail account
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Sync">
        <div className="border-t border-border/60">
          <SettingsRow
            label="Import history"
            hint={formatImportHistoryHint(
              syncPreference?.months ?? null,
              syncPreference?.cutoffAt ?? null,
            )}
          >
            <ButtonGroup className="w-full sm:w-auto">
              {syncWindowOptions.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  size="sm"
                  variant={selectedSyncMonths === option.value ? "default" : "outline"}
                  onClick={() => {
                    if (selectedSyncMonths === option.value) return;
                    syncPreferenceMutation.mutate(option.value);
                  }}
                  disabled={
                    isSyncing ||
                    selectedSyncMonths === option.value ||
                    syncPreferenceMutation.isPending ||
                    syncPreferenceQuery.isPending
                  }
                >
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
          </SettingsRow>
          <div className="border-t border-border/60" />
          <SettingsRow
            label={isSyncing ? "Syncing" : "Last synced"}
            hint={
              isSyncing && status?.progressCurrent
                ? `${new Intl.NumberFormat().format(status.progressCurrent)} emails processed`
                : formatLastSync(status?.lastSync ?? null)
            }
          >
            {isSyncing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SpinnerGapIcon className="size-4 animate-spin" />
                <span>In progress</span>
              </div>
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
          </SettingsRow>
          <div className="border-t border-border/60" />
          <SettingsRow
            label="Full re-import"
            hint="Re-download your mailbox from Gmail."
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => fullSyncMutation.mutate()}
              disabled={fullSyncMutation.isPending || isSyncing}
            >
              {fullSyncMutation.isPending ? "Starting..." : "Re-import"}
            </Button>
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title="Appearance">
        <div className="border-t border-border/60">
          <SettingsRow label="Theme" hint="Choose how Petit looks.">
            <ButtonGroup className="w-full sm:w-auto">
              {themeOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={theme === option.value ? "default" : "outline"}
                  onClick={() => setTheme(option.value)}
                >
                  <option.icon className="size-3.5" />
                  {option.label}
                </Button>
              ))}
            </ButtonGroup>
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Danger Zone"
        description="Permanently delete your account and all associated data."
        danger
      >
        <div className="border-t border-destructive/30">
          <SettingsRow
            label="Delete account"
            hint='Type "DELETE" to enable the action.'
            alignTop
          >
            <div className="space-y-3">
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="w-full text-sm sm:w-64"
              />
              <div className="flex justify-end sm:justify-start">
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
          </SettingsRow>
        </div>
      </SettingsSection>
    </div>
  );
}
