import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import {
  beginGmailConnection,
  runIncrementalSync,
  startFullSync,
} from "@/features/home/mutations";
import {
  deleteAccount,
  updateSyncPreference,
} from "@/features/settings/mutations";
import { useAuth } from "@/hooks/use-auth";
import {
  getMailboxDisplayEmail,
  removeAccount,
  useMailboxes,
} from "@/hooks/use-mailboxes";
import { useTheme } from "@/hooks/use-theme";
import {
  ArrowClockwiseIcon,
  MonitorIcon,
  MoonIcon,
  SpinnerGapIcon,
  SunIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SyncIntent = "initial" | "incremental" | "reimport" | "auto-connect";

const syncWindowOptions = [
  { value: 6 as const, label: "6 months" },
  { value: 12 as const, label: "1 year" },
  { value: null, label: "Everything" },
];

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

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [confirmText, setConfirmText] = useState("");
  const handledConnectedImportRef = useRef(false);

  const accountsQuery = useMailboxes();
  const accounts = accountsQuery.data?.accounts ?? [];

  const addAccountMutation = useMutation({
    mutationFn: () => beginGmailConnection("/settings?connected=1"),
    onError: () => toast.error("Failed to connect Gmail account"),
  });

  const [removingAccountId, setRemovingAccountId] = useState<string | null>(
    null,
  );
  const removeAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      setRemovingAccountId(accountId);
      await removeAccount(accountId);
    },
    onSuccess: async () => {
      toast.success("Account removed");
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setRemovingAccountId(null),
  });

  const [pendingMailboxActionIds, setPendingMailboxActionIds] = useState<
    number[]
  >([]);
  const mailboxSyncMutation = useMutation({
    mutationFn: async ({
      mailboxId,
      intent,
    }: {
      mailboxId: number;
      intent: SyncIntent;
    }) => {
      if (intent === "incremental") {
        await runIncrementalSync(mailboxId);
        return;
      }

      await startFullSync(undefined, mailboxId);
    },
    onMutate: ({ mailboxId }) => {
      setPendingMailboxActionIds((current) =>
        current.includes(mailboxId) ? current : [...current, mailboxId],
      );
    },
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.intent === "incremental"
          ? "Sync started"
          : variables.intent === "reimport"
            ? "Full re-import started"
            : variables.intent === "auto-connect"
              ? "Account connected. Import started."
              : "Import started",
      );
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: (_error, variables) => {
      toast.error(
        variables.intent === "incremental"
          ? "Failed to start sync"
          : variables.intent === "reimport"
            ? "Failed to start re-import"
            : "Failed to start import",
      );
    },
    onSettled: (_data, _error, variables) => {
      setPendingMailboxActionIds((current) =>
        current.filter((mailboxId) => mailboxId !== variables.mailboxId),
      );
    },
  });

  const [pendingSyncWindowMailboxIds, setPendingSyncWindowMailboxIds] =
    useState<number[]>([]);
  const syncPreferenceMutation = useMutation({
    mutationFn: updateSyncPreference,
    onMutate: ({ mailboxId }) => {
      setPendingSyncWindowMailboxIds((current) =>
        current.includes(mailboxId) ? current : [...current, mailboxId],
      );
    },
    onSuccess: async (result, variables) => {
      const { mailboxId, months } = variables;
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["sync-status"] });

      if (result.requiresBackfill) {
        try {
          await startFullSync(undefined, mailboxId);
          toast.success(
            months === null
              ? "Import history updated. Full mailbox backfill started."
              : "Import history updated. Backfill started.",
          );
          await queryClient.invalidateQueries({ queryKey: ["accounts"] });
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
    onSettled: (_data, _error, variables) => {
      setPendingSyncWindowMailboxIds((current) =>
        current.filter((mailboxId) => mailboxId !== variables.mailboxId),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success("Account deleted");
      navigate({ to: "/login" });
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (handledConnectedImportRef.current || typeof window === "undefined")
      return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") !== "1") return;
    if (accountsQuery.isPending) return;

    handledConnectedImportRef.current = true;
    params.delete("connected");
    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      nextSearch
        ? `${window.location.pathname}?${nextSearch}`
        : window.location.pathname,
    );

    const newestUnsyncedAccount = [...accounts]
      .filter(
        (account) =>
          account.mailboxId != null &&
          !account.hasSynced &&
          account.hasValidCredentials &&
          account.syncState !== "syncing",
      )
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];

    if (!newestUnsyncedAccount?.mailboxId) return;
    const mailboxId = newestUnsyncedAccount.mailboxId;

    void (async () => {
      if (accounts.length > 1 && newestUnsyncedAccount.syncWindowMonths !== 6) {
        try {
          await updateSyncPreference({
            mailboxId,
            months: 6,
          });
          await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        } catch {
          toast.error("Failed to set import history for the new account");
          return;
        }
      }

      mailboxSyncMutation.mutate({
        mailboxId,
        intent: "auto-connect",
      });
    })();
  }, [accounts, accountsQuery.isPending, mailboxSyncMutation, queryClient]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <PageHeader title="Settings" />

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Account
          </h2>
        </div>
        <div className="border-t border-border/60">
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Name</p>
            </div>
            <p className="text-sm text-foreground sm:text-right">
              {user?.name ?? "—"}
            </p>
          </div>
          <div className="border-t border-border/60" />
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Email</p>
            </div>
            <p className="truncate text-sm text-foreground sm:text-right">
              {user?.email ?? "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Connected accounts
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Manage your linked Gmail accounts.
          </p>
        </div>

        <div className="border-t border-border/60">
          {accounts.map((account) => {
            const isBusy =
              account.syncState === "syncing" ||
              (account.mailboxId != null &&
                pendingMailboxActionIds.includes(account.mailboxId));
            const isUpdatingSyncWindow =
              account.mailboxId != null &&
              pendingSyncWindowMailboxIds.includes(account.mailboxId);
            const canSync =
              account.mailboxId != null &&
              account.hasValidCredentials &&
              account.syncState !== "needs_reconnect";

            const statusText =
              account.syncState === "needs_reconnect"
                ? "Reconnect required"
                : account.syncState === "error"
                  ? account.hasSynced
                    ? "Last sync failed"
                    : "Import failed"
                  : isBusy
                    ? "Syncing..."
                    : account.hasSynced
                      ? account.lastSync
                        ? `Synced ${formatDistanceToNow(new Date(account.lastSync), { addSuffix: true })}`
                        : "Synced"
                      : "Not synced";

            const statusTone =
              account.syncState === "error" ||
              account.syncState === "needs_reconnect"
                ? "bg-amber-500"
                : account.syncState === "syncing"
                  ? "bg-sky-500"
                  : "bg-green-500";

            const activityHint =
              account.syncState === "needs_reconnect"
                ? "Reconnect Gmail to resume syncing."
                : account.syncState === "error" && account.error
                  ? account.error
                  : isBusy
                    ? typeof account.progressCurrent === "number"
                      ? `${new Intl.NumberFormat().format(account.progressCurrent)} emails processed`
                      : account.phase === "listing"
                        ? "Scanning your mailbox..."
                        : "Import in progress"
                    : account.lastSync
                      ? formatDistanceToNow(new Date(account.lastSync), {
                          addSuffix: true,
                        })
                      : "Never";

            const primaryLabel =
              account.syncState === "needs_reconnect"
                ? "Reconnect needed"
                : account.hasSynced
                  ? "Sync now"
                  : "Start import";

            return (
              <div key={account.accountId}>
                <div className="flex items-start justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {getMailboxDisplayEmail(account) ?? "Unknown account"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`inline-block size-1.5 rounded-full ${statusTone}`}
                      />
                      {statusText}
                    </div>
                  </div>
                  {accounts.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        removeAccountMutation.mutate(account.accountId)
                      }
                      disabled={
                        removingAccountId === account.accountId || isBusy
                      }
                    >
                      <TrashIcon className="size-3.5 text-muted-foreground" />
                    </Button>
                  ) : null}
                </div>

                <div className="border-t border-border/60">
                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Import history</p>
                      <p className="text-xs text-muted-foreground">
                        {formatImportHistoryHint(
                          account.syncWindowMonths,
                          account.syncCutoffAt,
                        )}
                      </p>
                    </div>
                    <div className="min-w-0 sm:max-w-[60%]">
                      <ButtonGroup className="w-full sm:w-auto">
                        {syncWindowOptions.map((option) => (
                          <Button
                            key={option.label}
                            type="button"
                            size="sm"
                            variant={
                              account.syncWindowMonths === option.value
                                ? "default"
                                : "outline"
                            }
                            onClick={() => {
                              if (!account.mailboxId) return;
                              if (account.syncWindowMonths === option.value)
                                return;
                              syncPreferenceMutation.mutate({
                                mailboxId: account.mailboxId,
                                months: option.value,
                              });
                            }}
                            disabled={
                              !account.mailboxId ||
                              isBusy ||
                              isUpdatingSyncWindow ||
                              account.syncWindowMonths === option.value
                            }
                          >
                            {option.label}
                          </Button>
                        ))}
                      </ButtonGroup>
                    </div>
                  </div>

                  <div className="border-t border-border/60" />

                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {isBusy ? "Syncing" : "Last synced"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activityHint}
                      </p>
                    </div>
                    <div className="min-w-0 sm:max-w-[60%]">
                      {isBusy ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <SpinnerGapIcon className="size-4 animate-spin" />
                          <span>In progress</span>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!account.mailboxId) return;
                            mailboxSyncMutation.mutate({
                              mailboxId: account.mailboxId,
                              intent: account.hasSynced
                                ? "incremental"
                                : "initial",
                            });
                          }}
                          disabled={!canSync || isUpdatingSyncWindow}
                        >
                          <ArrowClockwiseIcon className="mr-1.5 size-3.5" />
                          {primaryLabel}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border/60" />

                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Full re-import</p>
                      <p className="text-xs text-muted-foreground">
                        Re-download this mailbox from Gmail.
                      </p>
                    </div>
                    <div className="min-w-0 sm:max-w-[60%]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!account.mailboxId) return;
                          mailboxSyncMutation.mutate({
                            mailboxId: account.mailboxId,
                            intent: "reimport",
                          });
                        }}
                        disabled={!canSync || isBusy || isUpdatingSyncWindow}
                      >
                        Re-import
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/60" />
              </div>
            );
          })}

          <div className="py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addAccountMutation.mutate()}
              disabled={addAccountMutation.isPending}
            >
              Add Gmail account
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Appearance
          </h2>
        </div>
        <div className="border-t border-border/60">
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">
                Choose how Petit looks.
              </p>
            </div>
            <div className="min-w-0 sm:max-w-[60%]">
              <ButtonGroup className="w-full sm:w-auto">
                {[
                  { value: "light" as const, label: "Light", icon: SunIcon },
                  { value: "dark" as const, label: "Dark", icon: MoonIcon },
                  {
                    value: "system" as const,
                    label: "System",
                    icon: MonitorIcon,
                  },
                ].map((option) => (
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
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-destructive">
            Danger Zone
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Permanently delete your account and all associated data.
          </p>
        </div>
        <div className="border-t border-destructive/30">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">
                Type "DELETE" to enable the action.
              </p>
            </div>
            <div className="min-w-0 sm:max-w-[60%]">
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
                    disabled={
                      confirmText !== "DELETE" || deleteMutation.isPending
                    }
                  >
                    {deleteMutation.isPending
                      ? "Deleting..."
                      : "Delete account"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
