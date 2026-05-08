import { Button } from "@/components/ui/button";
import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { useSettingsMutations } from "@/features/settings/hooks/use-settings-mutations";
import {
 getMailboxDisplayEmail,
 useMailboxes,
 type MailboxAccount,
} from "@/hooks/use-mailboxes";
import { ArrowClockwiseIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function MailboxPage() {
 const navigate = useNavigate();
 const { mailboxId } = useParams({ from: "/_dashboard/$mailboxId/settings" });
 const handledConnectedImportRef = useRef(false);
 const accountsQuery = useMailboxes();
 const account =
 accountsQuery.data?.accounts.find(
 (entry) => entry.mailboxId === mailboxId,
 ) ?? null;

 const { fullReimportMutation, pendingMailboxActionIds, addAccountMutation } =
 useSettingsMutations({ navigate });

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

 return accountsQuery.isPending ? (
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
 <p className="py-3 text-xs text-muted-foreground">Mailbox not found.</p>
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
 className={`inline-block size-1.5 ${
 account.syncState === "needs_reconnect" ||
 account.syncState === "error"
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
 {needsReconnect && (
 <Button
 variant="outline"
 size="sm"
 onClick={onReconnect}
 disabled={isConnecting}
 >
 {isConnecting ? "Connecting..." : "Reconnect Gmail"}
 </Button>
 )}
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
 {account.mailboxId != null && (
 <MailboxDiagnostics mailboxId={account.mailboxId} />
 )}
 </div>
 );
}

type MailboxDiagnosticsState = {
 localEmailCount: number | null;
 storageUsage: number | null;
 storageQuota: number | null;
 storagePersisted: boolean | null;
 jsHeapUsed: number | null;
 jsHeapLimit: number | null;
};

function MailboxDiagnostics({ mailboxId }: { mailboxId: number }) {
 const [state, setState] = useState<MailboxDiagnosticsState>({
 localEmailCount: null,
 storageUsage: null,
 storageQuota: null,
 storagePersisted: null,
 jsHeapUsed: null,
 jsHeapLimit: null,
 });

 useEffect(() => {
 let cancelled = false;

 async function load() {
 const userId = await getCurrentUserId();
 let localEmailCount: number | null = null;
 if (userId) {
 try {
 await localDb.ensureReady();
 localEmailCount = await localDb.emailCount(userId, mailboxId);
 } catch {
 localEmailCount = null;
 }
 }

 const estimate = await navigator.storage?.estimate?.().catch(() => null);
 const storagePersisted =
 (await navigator.storage?.persisted?.().catch(() => null)) ?? null;
 const memory = Reflect.get(performance, "memory") as
 | {
 usedJSHeapSize?: number;
 jsHeapSizeLimit?: number;
 }
 | undefined;

 if (cancelled) return;
 setState({
 localEmailCount,
 storageUsage:
 typeof estimate?.usage === "number" ? estimate.usage : null,
 storageQuota:
 typeof estimate?.quota === "number" ? estimate.quota : null,
 storagePersisted,
 jsHeapUsed:
 typeof memory?.usedJSHeapSize === "number"
 ? memory.usedJSHeapSize
 : null,
 jsHeapLimit:
 typeof memory?.jsHeapSizeLimit === "number"
 ? memory.jsHeapSizeLimit
 : null,
 });
 }

 void load();
 return () => {
 cancelled = true;
 };
 }, [mailboxId]);

 return (
 <div className="border-t border-border/60 py-3">
 <div className="mb-2 space-y-0.5">
 <p className="text-xs font-medium">Diagnostics</p>
 <p className="text-xs text-muted-foreground">
 Local cache and browser storage for this mailbox.
 </p>
 </div>
 <dl className="grid gap-2 text-xs sm:grid-cols-2">
 <DiagnosticItem
 label="Local emails"
 value={
 state.localEmailCount == null
 ? "Unavailable"
 : state.localEmailCount.toLocaleString()
 }
 />
 <DiagnosticItem
 label="Storage"
 value={formatStoragePair(state.storageUsage, state.storageQuota)}
 />
 <DiagnosticItem
 label="Persistent storage"
 value={
 state.storagePersisted == null
 ? "Unavailable"
 : state.storagePersisted
 ? "Enabled"
 : "Not granted"
 }
 />
 <DiagnosticItem
 label="JS memory"
 value={formatStoragePair(state.jsHeapUsed, state.jsHeapLimit)}
 />
 </dl>
 </div>
 );
}

function DiagnosticItem({ label, value }: { label: string; value: string }) {
 return (
 <div className="flex items-center justify-between gap-3 border border-border/60 px-2.5 py-2">
 <dt className="text-muted-foreground">{label}</dt>
 <dd className="font-mono text-[11px] text-foreground">{value}</dd>
 </div>
 );
}

function formatBytes(bytes: number | null): string | null {
 if (bytes == null || !Number.isFinite(bytes)) return null;
 if (bytes < 1024) return `${bytes} B`;
 const units = ["KB", "MB", "GB"];
 let value = bytes / 1024;
 let unit = units[0]!;
 for (let i = 1; i < units.length && value >= 1024; i++) {
 value /= 1024;
 unit = units[i]!;
 }
 return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function formatStoragePair(used: number | null, limit: number | null): string {
 const usedText = formatBytes(used);
 const limitText = formatBytes(limit);
 if (usedText && limitText) return `${usedText} / ${limitText}`;
 return usedText ?? "Unavailable";
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
