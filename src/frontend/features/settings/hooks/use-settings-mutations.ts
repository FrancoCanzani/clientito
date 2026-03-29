import {
  beginGmailConnection,
  runIncrementalSync,
  startFullSync,
} from "@/features/home/mutations";
import {
  deleteAccount,
  updateMailboxSignature,
  updateSyncPreference,
} from "@/features/settings/mutations";
import { removeAccount } from "@/hooks/use-mailboxes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

type SyncIntent = "initial" | "incremental" | "reimport" | "auto-connect";

export function useSettingsMutations({
  navigate,
}: {
  navigate: (opts: { to: string }) => void;
}) {
  const queryClient = useQueryClient();

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

  const signatureMutation = useMutation({
    mutationFn: async ({
      mailboxId,
      signature,
    }: {
      mailboxId: number;
      signature: string;
    }) => updateMailboxSignature(mailboxId, signature),
    onSuccess: async () => {
      toast.success("Signature saved");
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
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

  return {
    addAccountMutation,
    removeAccountMutation,
    removingAccountId,
    mailboxSyncMutation,
    pendingMailboxActionIds,
    syncPreferenceMutation,
    pendingSyncWindowMailboxIds,
    signatureMutation,
    deleteMutation,
  };
}
