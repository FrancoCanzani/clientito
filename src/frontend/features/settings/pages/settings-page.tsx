import { clearLocalData } from "@/db/sync";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { SignatureField } from "@/features/settings/components/signature-field";
import { updateSyncPreference } from "@/features/settings/mutations";
import { useSettingsMutations } from "@/features/settings/hooks/use-settings-mutations";
import {
  formatImportHistoryHint,
  getMailboxStatusCopy,
} from "@/features/settings/utils/sync-formatting";
import { useAuth } from "@/hooks/use-auth";
import {
  getMailboxDisplayEmail,
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
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type SyncWindowOption = {
  value: 6 | 12 | null;
  label: string;
};

type ThemeOption = {
  value: "light" | "dark" | "system";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const syncWindowOptions: SyncWindowOption[] = [
  { value: 6, label: "6 months" },
  { value: 12, label: "1 year" },
  { value: null, label: "Everything" },
];

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [confirmText, setConfirmText] = useState("");
  const handledConnectedImportRef = useRef(false);

  const accountsQuery = useMailboxes();
  const accounts = accountsQuery.data?.accounts ?? [];

  const {
    addAccountMutation,
    removeAccountMutation,
    removingAccountId,
    mailboxSyncMutation,
    pendingMailboxActionIds,
    syncPreferenceMutation,
    pendingSyncWindowMailboxIds,
    signatureMutation,
    deleteMutation,
  } = useSettingsMutations({ navigate });

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

    (async () => {
      if (accounts.length > 1 && newestUnsyncedAccount.syncWindowMonths !== 6) {
        try {
          await updateSyncPreference({
            mailboxId,
            months: 6,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
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
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12">
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
            const statusCopy = getMailboxStatusCopy(account, isBusy);

            return (
              <div key={account.accountId}>
                <div className="flex items-start justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {getMailboxDisplayEmail(account) ?? "Unknown account"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={`inline-block size-1.5 rounded-full ${statusCopy.badgeTone}`}
                      />
                      {statusCopy.badge}
                    </div>
                  </div>
                  {accounts.length > 1 && (
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
                  )}
                </div>

                <div className="border-t border-border/60">
                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">History window</p>
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
                      <p className="text-sm font-medium">{statusCopy.sectionTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {statusCopy.detail}
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
                          {statusCopy.primaryLabel}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border/60" />

                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Fresh full import</p>
                      <p className="text-xs text-muted-foreground">
                        {statusCopy.reimportHint}
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
                        Run full import
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/60" />

                <SignatureField
                  mailboxId={account.mailboxId}
                  initialSignature={account.signature ?? ""}
                  isSaving={signatureMutation.isPending}
                  onSave={(mailboxId, signature) =>
                    signatureMutation.mutate({ mailboxId, signature })
                  }
                />
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
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Local data
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Petit keeps a local copy of your emails for fast offline access.
            Resetting clears the cache — your emails will re-sync from the
            server on next load.
          </p>
        </div>
        <div className="border-t border-border/60">
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Reset local data</p>
              <p className="text-xs text-muted-foreground">
                Clears the browser cache. No emails are deleted from your
                account.
              </p>
            </div>
            <div className="min-w-0 sm:max-w-[60%]">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await clearLocalData();
                  queryClient.clear();
                  toast.success("Local data cleared — reloading…");
                  setTimeout(() => window.location.reload(), 600);
                }}
              >
                Reset local data
              </Button>
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
