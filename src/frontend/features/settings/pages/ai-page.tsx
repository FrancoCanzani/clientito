import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { SettingsSectionHeader } from "@/features/settings/components/settings-shell";
import { updateMailboxAiEnabled } from "@/features/settings/mutations";
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

  const mutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      updateMailboxAiEnabled(id, enabled),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all() });
      toast.success(
        variables.enabled ? "AI features enabled" : "AI features disabled",
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const aiEnabled = account?.aiEnabled ?? true;

  return (
    <section className="space-y-3">
      <SettingsSectionHeader
        group="Mail"
        title="AI"
        description="Control AI-powered features for this mailbox."
      />
      <div className="border-t border-border/60">
        {accountsQuery.isPending ? (
          <div className="flex min-h-40 items-center justify-center">
            <SpinnerGapIcon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !account || account.mailboxId == null ? (
          <p className="py-3 text-xs text-muted-foreground">Mailbox not found.</p>
        ) : (
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">AI features</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Inbox classification, summaries, draft replies, and composer
                writing tools (grammar, rewrite, tone). When off, none of these
                run and no email content is sent to the AI provider.
              </p>
            </div>
            <ButtonGroup className="w-full sm:w-auto">
              <Button
                type="button"
                size="sm"
                variant={aiEnabled ? "default" : "outline"}
                disabled={mutation.isPending || aiEnabled}
                onClick={() =>
                  mutation.mutate({ id: account.mailboxId!, enabled: true })
                }
              >
                On
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!aiEnabled ? "default" : "outline"}
                disabled={mutation.isPending || !aiEnabled}
                onClick={() =>
                  mutation.mutate({ id: account.mailboxId!, enabled: false })
                }
              >
                Off
              </Button>
            </ButtonGroup>
          </div>
        )}
      </div>
    </section>
  );
}
