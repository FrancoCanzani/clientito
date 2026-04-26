import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { LabelsSettingsSection } from "@/features/settings/components/labels-settings-section";
import { SignatureField } from "@/features/settings/components/signature-field";
import { useSettingsMutations } from "@/features/settings/hooks/use-settings-mutations";
import { useAuth, useLogout } from "@/hooks/use-auth";
import {
  getMailboxDisplayEmail,
  useMailboxes,
  type MailboxAccount,
} from "@/hooks/use-mailboxes";
import { useTheme } from "@/hooks/use-theme";
import {
  ArrowClockwiseIcon,
  MonitorIcon,
  MoonIcon,
  SpinnerGapIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const settingsRoute = getRouteApi("/_dashboard/$mailboxId/settings");

type ThemeOption = {
  value: "light" | "dark" | "system";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [confirmText, setConfirmText] = useState("");
  const handledConnectedImportRef = useRef(false);
  const { mailboxId } = settingsRoute.useParams();

  const accountsQuery = useMailboxes();
  const accounts = accountsQuery.data?.accounts ?? [];
  const isLoadingAccounts = accountsQuery.isPending;
  const activeAccount =
    accounts.find((account) => account.mailboxId === mailboxId) ?? null;

  const {
    fullReimportMutation,
    pendingMailboxActionIds,
    signatureMutation,
    deleteMutation,
  } = useSettingsMutations({ navigate });

  useEffect(() => {
    if (handledConnectedImportRef.current || typeof window === "undefined")
      return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") !== "1") return;
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
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>Settings</span>
          </div>
        }
        className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-12">
        {isLoadingAccounts ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <SpinnerGapIcon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-20 p-1">
                <p className="px-3 py-1 text-[10px] font-medium text-muted-foreground">
                  General
                </p>
                <a
                  href="#account"
                  className="block rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  Account
                </a>
                <a
                  href="#appearance"
                  className="block rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  Appearance
                </a>

                <p className="px-3 pt-4 pb-1 text-[10px] font-medium text-muted-foreground">
                  Mail
                </p>
                <a
                  href="#connected-accounts"
                  className="block rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  Mailbox
                </a>
                <a
                  href="#labels"
                  className="block rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  Labels
                </a>

                <p className="px-3 pt-4 pb-1 text-[10px] font-medium text-muted-foreground">
                  Safety
                </p>
                <a
                  href="#danger-zone"
                  className="block rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  Danger zone
                </a>
              </div>
            </aside>

            <div className="space-y-12">
              <section id="account" className="scroll-mt-20">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    General
                  </p>
                  <h2 className="text-xs font-medium text-foreground">
                    Account
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Basic profile details for your Duomo account.
                  </p>
                </div>
                <div className="mt-4 border-t border-border/60">
                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Name</p>
                    </div>
                    <p className="text-xs text-foreground sm:text-right">
                      {user?.name ?? "—"}
                    </p>
                  </div>
                  <div className="border-t border-border/60" />
                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Email</p>
                    </div>
                    <p className="truncate text-xs text-foreground sm:text-right">
                      {user?.email ?? "—"}
                    </p>
                  </div>
                  <div className="border-t border-border/60" />
                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Session</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={logoutMutation.isPending}
                      onClick={() => logoutMutation.mutate()}
                    >
                      {logoutMutation.isPending ? "Signing out..." : "Sign out"}
                    </Button>
                  </div>
                </div>
              </section>

              <section id="connected-accounts" className="scroll-mt-20">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Mail
                  </p>
                  <h2 className="text-xs font-medium text-foreground">
                    Mailbox
                  </h2>
                  <p className="max-w-lg text-xs text-muted-foreground">
                    Settings for the currently selected account.
                  </p>
                </div>

                <div className="mt-4 border-t border-border/60">
                  {activeAccount ? (
                    <AccountRow
                      account={activeAccount}
                      isBusy={
                        activeAccount.mailboxId != null &&
                        pendingMailboxActionIds.includes(activeAccount.mailboxId)
                      }
                      onReimport={async (mailboxId) => {
                        const drafts = await countLocalDrafts();
                        if (!confirmReimport(drafts)) return;
                        fullReimportMutation.mutate(mailboxId);
                      }}
                      onSaveSignature={(mailboxId, signature) =>
                        signatureMutation.mutate({ mailboxId, signature })
                      }
                      isSavingSignature={signatureMutation.isPending}
                    />
                  ) : (
                    <p className="py-3 text-xs text-muted-foreground">
                      Mailbox not found.
                    </p>
                  )}
                </div>
              </section>

              <LabelsSettingsSection mailboxId={mailboxId} />

              <section id="appearance" className="scroll-mt-20">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    General
                  </p>
                  <h2 className="text-xs font-medium text-foreground">
                    Appearance
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Pick how the interface is rendered.
                  </p>
                </div>
                <div className="mt-4 border-t border-border/60">
                  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Theme</p>
                      <p className="text-xs text-muted-foreground">
                        Choose how Duomo looks.
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

              <section id="danger-zone" className="scroll-mt-20">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Safety
                  </p>
                  <h2 className="text-xs font-medium text-destructive">
                    Danger Zone
                  </h2>
                  <p className="max-w-lg text-xs text-muted-foreground">
                    Permanently delete your account and all associated data.
                  </p>
                </div>
                <div className="mt-4 border-t border-destructive/30">
                  <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Delete account</p>
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
                          className="w-full text-xs sm:w-64"
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
          </div>
        )}
      </div>
    </div>
  );
}

function AccountRow({
  account,
  isBusy,
  onReimport,
  onSaveSignature,
  isSavingSignature,
}: {
  account: MailboxAccount;
  isBusy: boolean;
  onReimport: (mailboxId: number) => void | Promise<void>;
  onSaveSignature: (mailboxId: number, signature: string) => void;
  isSavingSignature: boolean;
}) {
  const canReimport =
    account.mailboxId != null &&
    account.hasValidCredentials &&
    account.syncState !== "needs_reconnect";

  return (
    <div>
      <div className="flex items-start justify-between gap-3 py-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-xs font-medium">
            {getMailboxDisplayEmail(account) ?? "Unknown account"}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`inline-block size-1.5 rounded-full ${
                account.syncState === "needs_reconnect" || account.syncState === "error"
                  ? "bg-amber-500"
                  : account.hasSynced
                    ? "bg-green-500"
                    : "bg-zinc-400"
              }`}
            />
            {account.syncState === "needs_reconnect"
              ? "Reconnect Gmail"
              : account.syncState === "error"
                ? account.hasSynced
                  ? "Sync needs attention"
                  : "Import needs attention"
                : account.hasSynced
                  ? "Up to date"
                  : "Connected"}
          </div>
          <p className="text-xs text-muted-foreground">
            {account.syncState === "needs_reconnect"
              ? "Google access expired. Reconnect this account to resume mailbox sync."
              : account.syncState === "error"
                ? account.error?.trim() || "Sync hit an unexpected error."
                : account.hasSynced
                  ? "Your mailbox is connected and syncing normally."
                  : "Your account is connected. First sync starts automatically when you open Inbox."}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium">Clear local cache</p>
            <p className="text-xs text-muted-foreground">
              {account.syncState === "needs_reconnect"
                ? "Reconnect first, then clear cache only if the mailbox still looks incomplete."
                : "Clear cache rebuilds local mailbox data from Gmail."}
            </p>
          </div>
          <div className="min-w-0 sm:max-w-[60%]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (account.mailboxId == null) return;
                void onReimport(account.mailboxId);
              }}
              disabled={!canReimport || isBusy}
            >
              <ArrowClockwiseIcon className="mr-1.5 size-3.5" />
              {isBusy ? "In progress..." : "Clear cache"}
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-border/60" />

      <SignatureField
        mailboxId={account.mailboxId}
        initialSignature={account.signature ?? ""}
        isSaving={isSavingSignature}
        onSave={onSaveSignature}
      />
    </div>
  );
}

async function countLocalDrafts(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;
  try {
    await localDb.ensureReady();
    const drafts = await localDb.getDrafts(userId);
    return drafts.length;
  } catch (error) {
    console.warn("Failed to count local drafts", error);
    return 0;
  }
}

function confirmReimport(drafts: number): boolean {
  if (drafts === 0) {
    return window.confirm(
      "Re-import will clear the local cache and re-sync your mailbox from Gmail. Continue?",
    );
  }
  const warning = `You have ${drafts} unsent ${drafts === 1 ? "draft" : "drafts"} stored only in this browser. They will be lost if you re-import now. Continue?`;
  toast.warning(warning);
  return window.confirm(warning);
}
