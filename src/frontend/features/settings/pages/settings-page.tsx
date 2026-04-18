import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { LabelsSettingsSection } from "@/features/settings/components/labels-settings-section";
import { SignatureField } from "@/features/settings/components/signature-field";
import { useSettingsMutations } from "@/features/settings/hooks/use-settings-mutations";
import { getMailboxStatusCopy } from "@/features/settings/utils/sync-formatting";
import { useAuth } from "@/hooks/use-auth";
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
  TrashIcon,
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
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [confirmText, setConfirmText] = useState("");
  const handledConnectedImportRef = useRef(false);
  const { mailboxId } = settingsRoute.useParams();

  const accountsQuery = useMailboxes();
  const accounts = accountsQuery.data?.accounts ?? [];

  const {
    addAccountMutation,
    removeAccountMutation,
    removingAccountId,
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
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12">
      <PageHeader title="Settings" className="px-0" />

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
          {accounts.map((account) => (
            <AccountRow
              key={account.accountId}
              account={account}
              canRemove={accounts.length > 1}
              isBusy={
                account.mailboxId != null &&
                pendingMailboxActionIds.includes(account.mailboxId)
              }
              isRemoving={removingAccountId === account.accountId}
              onRemove={() => removeAccountMutation.mutate(account.accountId)}
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
          ))}

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

      <LabelsSettingsSection mailboxId={mailboxId} />

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

function AccountRow({
  account,
  canRemove,
  isBusy,
  isRemoving,
  onRemove,
  onReimport,
  onSaveSignature,
  isSavingSignature,
}: {
  account: MailboxAccount;
  canRemove: boolean;
  isBusy: boolean;
  isRemoving: boolean;
  onRemove: () => void;
  onReimport: (mailboxId: number) => void | Promise<void>;
  onSaveSignature: (mailboxId: number, signature: string) => void;
  isSavingSignature: boolean;
}) {
  const statusCopy = getMailboxStatusCopy(account);
  const canReimport =
    account.mailboxId != null &&
    account.hasValidCredentials &&
    account.syncState !== "needs_reconnect";

  return (
    <div>
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
          <p className="text-xs text-muted-foreground">{statusCopy.detail}</p>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={isRemoving || isBusy}
          >
            <TrashIcon className="size-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      <div className="border-t border-border/60">
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Clear local cache</p>
            <p className="text-xs text-muted-foreground">
              {statusCopy.reimportHint}
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
                  if (account.mailboxId == null) return;
                  void onReimport(account.mailboxId);
                }}
                disabled={!canReimport}
              >
                <ArrowClockwiseIcon className="mr-1.5 size-3.5" />
                Clear cache
              </Button>
            )}
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
