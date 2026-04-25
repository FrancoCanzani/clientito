import { accountQueryKeys } from "@/features/settings/query-keys";
import { clearLocalData } from "@/db/client";
import { beginGmailConnection } from "@/features/onboarding/mutations";
import {
  deleteAccount,
  updateMailboxSignature,
  updateMailboxTemplates,
  updateSyncPreference,
} from "@/features/settings/mutations";
import { removeAccount } from "@/hooks/use-mailboxes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export function useSettingsMutations({
  navigate,
}: {
  navigate: (opts: { to: string }) => void;
}) {
  const queryClient = useQueryClient();

  const addAccountMutation = useMutation({
    mutationFn: () =>
      beginGmailConnection(`${window.location.pathname}?connected=1`),
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
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setRemovingAccountId(null),
  });

  const [pendingMailboxActionIds, setPendingMailboxActionIds] = useState<
    number[]
  >([]);
  const fullReimportMutation = useMutation({
    mutationFn: async (_mailboxId: number) => {
      await clearLocalData();
      queryClient.clear();
    },
    onMutate: (mailboxId) => {
      setPendingMailboxActionIds((current) =>
        current.includes(mailboxId) ? current : [...current, mailboxId],
      );
    },
    onSuccess: () => {
      toast.success("Local data cleared — reloading…");
      setTimeout(() => window.location.reload(), 600);
    },
    onError: () => toast.error("Failed to start full re-import"),
    onSettled: (_data, _error, mailboxId) => {
      setPendingMailboxActionIds((current) =>
        current.filter((id) => id !== mailboxId),
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
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
      toast.success("Signatures saved");
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
    },
    onError: () => toast.error("Failed to save signatures"),
  });

  const templatesMutation = useMutation({
    mutationFn: async ({
      mailboxId,
      templates,
    }: {
      mailboxId: number;
      templates: string;
    }) => updateMailboxTemplates(mailboxId, templates),
    onSuccess: async () => {
      toast.success("Templates saved");
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
    },
    onError: () => toast.error("Failed to save templates"),
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
    fullReimportMutation,
    pendingMailboxActionIds,
    syncPreferenceMutation,
    pendingSyncWindowMailboxIds,
    signatureMutation,
    templatesMutation,
    deleteMutation,
  };
}
