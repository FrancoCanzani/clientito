import { Button } from "@/components/ui/button";
import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { SettingsSectionHeader } from "@/features/settings/components/settings-shell";
import { useSettingsMutations } from "@/features/settings/hooks/use-settings-mutations";
import {
  getMailboxDisplayEmail,
  useMailboxes,
  type MailboxAccount,
} from "@/hooks/use-mailboxes";
import { ArrowClockwiseIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function MailboxPage() {
  const navigate = useNavigate();
  const { mailboxId } = useParams({ from: "/_dashboard/$mailboxId/settings" });
  const handledConnectedImportRef = useRef(false);
  const accountsQuery = useMailboxes();
  const account =
    accountsQuery.data?.accounts.find((entry) => entry.mailboxId === mailboxId) ??
    null;

  const {
    fullReimportMutation,
    pendingMailboxActionIds,
    addAccountMutation,
  } = useSettingsMutations({ navigate });

  useEffect(() => {
    if (handledConnectedImportRef.current || typeof window === "undefined") {
      return;
    }
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
    <section className="space-y-3">
      <SettingsSectionHeader
        group="Mail"
        title="Mailbox"
        description="Status and local cache controls for the current account."
      />
      <div className="border-t border-border/60">
        {accountsQuery.isPending ? (
          <div className="flex min-h-40 items-center justify-center">
            <SpinnerGapIcon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : account ? (
          <MailboxDetails
            account={account}
            isBusy={
              account.mailboxId != null &&
              pendingMailboxActionIds.includes(account.mailboxId)
            }
            isConnecting={addAccountMutation.isPending}
            onReconnect={() => addAccountMutation.mutate()}
            onReimport={async (targetMailboxId) => {
              const drafts = await countLocalDrafts();
              if (!confirmReimport(drafts)) return;
              fullReimportMutation.mutate(targetMailboxId);
            }}
          />
        ) : (
          <p className="py-3 text-xs text-muted-foreground">
            Mailbox not found.
          </p>
        )}
      </div>
    </section>
  );
}

function MailboxDetails({
  account,
  isBusy,
  isConnecting,
  onReconnect,
  onReimport,
}: {
  account: MailboxAccount;
  isBusy: boolean;
  isConnecting: boolean;
  onReconnect: () => void;
  onReimport: (mailboxId: number) => void | Promise<void>;
}) {
  const needsReconnect = account.syncState === "needs_reconnect";
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
        {needsReconnect ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onReconnect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Reconnect Gmail"}
          </Button>
        ) : null}
      </div>

      <div className="border-t border-border/60">
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium">Clear local cache</p>
            <p className="text-xs text-muted-foreground">
              {needsReconnect
                ? "Reconnect first, then clear cache only if the mailbox still looks incomplete."
                : "Clear cache rebuilds local mailbox data from Gmail."}
            </p>
          </div>
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
