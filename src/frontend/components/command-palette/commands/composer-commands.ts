import {
  COMPOSER_AI_ACTIONS,
  getComposerAiLabel,
  runComposerAiAction,
} from "@/features/email/inbox/components/compose/compose-ai-actions";
import { paletteIcon } from "../registry/palette-icon";
import { registerCommands } from "../registry/registry";
import type { Command, CommandContext } from "../registry/types";

const isComposerOpen = (ctx: CommandContext) => ctx.composerOpen;

const composerCommands: Command[] = COMPOSER_AI_ACTIONS.map((action) => ({
  id:
    action.id === "formal" || action.id === "casual" || action.id === "shorten"
      ? `composer:tone-${action.id}`
      : `composer:${action.id}`,
  label: () => getComposerAiLabel(action.id),
  icon: paletteIcon(action.icon),
  group: "composer",
  keywords: action.keywords,
  when: isComposerOpen,
  perform: async (_ctx, services) => {
    const applied = await runComposerAiAction(action.id);
    if (applied) {
      services.close();
    }
  },
}));

registerCommands(composerCommands);
