import type { Command, CommandContext } from "./types";

const commands: Command[] = [];

export function registerCommands(cmds: Command[]) {
  for (const cmd of cmds) {
    if (!commands.some((c) => c.id === cmd.id)) {
      commands.push(cmd);
    }
  }
}

export function getCommands(ctx: CommandContext): Command[] {
  return commands.filter((cmd) => !cmd.when || cmd.when(ctx));
}

export function resolveLabel(
  cmd: Command,
  ctx: CommandContext,
): string {
  return typeof cmd.label === "function" ? cmd.label(ctx) : cmd.label;
}
