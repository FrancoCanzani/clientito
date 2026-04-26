import {
  COMPOSER_AI_ACTIONS,
  getComposerAiLabel,
  runComposerAiAction,
} from "@/features/email/inbox/components/compose/compose-ai-actions";
import { accountsQueryOptions } from "@/hooks/use-mailboxes";
import { queryClient } from "@/lib/query-client";
import { paletteIcon } from "../registry/palette-icon";
import { registerCommands } from "../registry/registry";
import type { Command, CommandContext } from "../registry/types";

function isComposerAiAvailable(ctx: CommandContext): boolean {
  if (!ctx.composerOpen) return false;
  const mailboxId = ctx.activeMailboxId ?? ctx.defaultMailboxId;
  if (mailboxId == null) return false;
  const cached = queryClient.getQueryData(accountsQueryOptions.queryKey);
  const account = cached?.accounts.find((a) => a.mailboxId === mailboxId);
  return account?.aiEnabled ?? true;
}

const composerCommands: Command[] = COMPOSER_AI_ACTIONS.map((action) => ({
  id:
    action.id === "formal" || action.id === "casual" || action.id === "shorten"
      ? `composer:tone-${action.id}`
      : `composer:${action.id}`,
  label: () => getComposerAiLabel(action.id),
  icon: paletteIcon(action.icon),
  group: "composer",
  keywords: action.keywords,
  when: isComposerAiAvailable,
  perform: async (ctx, services) => {
    const mailboxId = ctx.activeMailboxId ?? ctx.defaultMailboxId;
    const applied = await runComposerAiAction(action.id, mailboxId);
    if (applied) {
      services.close();
    }
  },
}));

registerCommands(composerCommands);
