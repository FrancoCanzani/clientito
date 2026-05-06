import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  updateMailboxAiClassificationEnabled,
  updateMailboxAiEnabled,
} from "@/features/settings/mutations";
import { accountQueryKeys } from "@/features/settings/query-keys";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { toast } from "sonner";

export default function AiPage() {
  const { mailboxId } = useParams({ from: "/_dashboard/$mailboxId/settings" });
  const accountsQuery = useMailboxes();
  const queryClient = useQueryClient();

  const account =
    accountsQuery.data?.accounts.find((entry) => entry.mailboxId === mailboxId) ??
    null;

  const composerMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      updateMailboxAiEnabled(id, enabled),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
      toast.success(
        variables.enabled ? "Composer AI enabled" : "Composer AI disabled",
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const classificationMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      updateMailboxAiClassificationEnabled(id, enabled),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
      toast.success(
        variables.enabled
          ? "Inbox classification enabled"
          : "Inbox classification disabled",
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const aiEnabled = account?.aiEnabled ?? true;
  const aiClassificationEnabled = account?.aiClassificationEnabled ?? false;

  return accountsQuery.isPending ? (
    <div className="flex min-h-40 items-center justify-center">
      <SpinnerGapIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  ) : !account || account.mailboxId == null ? (
    <p className="py-3 text-xs text-muted-foreground">Mailbox not found.</p>
  ) : (
    <div className="flex flex-col gap-5 py-3">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">Composer AI</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Grammar, rewrite, tone, and other writing tools in compose.
              </p>
            </div>
            <ButtonGroup className="w-full sm:w-fit">
              <Button
                type="button"
                size="sm"
                variant={aiEnabled ? "default" : "outline"}
                disabled={composerMutation.isPending || aiEnabled}
                onClick={() =>
                  composerMutation.mutate({
                    id: account.mailboxId!,
                    enabled: true,
                  })
                }
              >
                On
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!aiEnabled ? "default" : "outline"}
                disabled={composerMutation.isPending || !aiEnabled}
                onClick={() =>
                  composerMutation.mutate({
                    id: account.mailboxId!,
                    enabled: false,
                  })
                }
              >
                Off
              </Button>
            </ButtonGroup>

            <div className="space-y-0.5">
              <p className="text-xs font-medium">Inbox classification</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Background inbox classification, summaries, and draft-reply
                suggestions.
              </p>
            </div>
            <ButtonGroup className="w-full sm:w-fit">
              <Button
                type="button"
                size="sm"
                variant={aiClassificationEnabled ? "default" : "outline"}
                disabled={
                  classificationMutation.isPending || aiClassificationEnabled
                }
                onClick={() =>
                  classificationMutation.mutate({
                    id: account.mailboxId!,
                    enabled: true,
                  })
                }
              >
                On
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!aiClassificationEnabled ? "default" : "outline"}
                disabled={
                  classificationMutation.isPending || !aiClassificationEnabled
                }
                onClick={() =>
                  classificationMutation.mutate({
                    id: account.mailboxId!,
                    enabled: false,
                  })
                }
              >
                Off
              </Button>
            </ButtonGroup>
    </div>
  );
}
