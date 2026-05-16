import { useMemo } from "react";
import { useAccountCommands } from "../commands/account-commands";
import { useActionCommands } from "../commands/action-commands";
import "../commands/navigation-commands";
import "../commands/email-commands";
import "../commands/compose-commands";
import "../commands/composer-commands";
import "../commands/scratchpad-commands";
import { getCommands } from "./registry";
import type { Command } from "./types";
import { useCommandContext } from "./use-command-context";

export function useAllCommands(enabled: boolean): {
 commands: Command[];
 ctx: ReturnType<typeof useCommandContext>;
} {
 const ctx = useCommandContext();

 const staticCommands = useMemo(
 () => (enabled ? getCommands(ctx) : []),
 [ctx, enabled],
 );
 const accountCommands = useAccountCommands(ctx);
 const actionCommands = useActionCommands();

 const commands = useMemo(
 () => [...staticCommands, ...accountCommands, ...actionCommands],
 [staticCommands, accountCommands, actionCommands],
 );

 return { commands, ctx };
}
