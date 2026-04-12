import { Kbd } from "@/components/ui/kbd";
import {
  AtIcon,
  CaretRightIcon,
  HashIcon,
} from "@phosphor-icons/react";
import { Command as Cmdk } from "cmdk";
import { resolveLabel } from "./registry/registry";
import type {
  Command,
  CommandContext,
  CommandServices,
} from "./registry/types";

const GROUP_ORDER = [
  "accounts",
  "email",
  "composer",
  "navigation",
  "actions",
];
type ModeHint = {
  sigil: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function groupCommands(commands: Command[]): Map<string, Command[]> {
  const map = new Map<string, Command[]>();
  for (const cmd of commands) {
    const group = map.get(cmd.group) ?? [];
    group.push(cmd);
    map.set(cmd.group, group);
  }
  return map;
}

function sortedGroups(groups: Map<string, Command[]>): [string, Command[]][] {
  return Array.from(groups.entries()).sort(([a], [b]) => {
    const ai = GROUP_ORDER.indexOf(a);
    const bi = GROUP_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

const MODE_HINTS: ModeHint[] = [
  { sigil: ">", label: "Commands", icon: CaretRightIcon },
  { sigil: "@", label: "Contacts", icon: AtIcon },
  { sigil: "#", label: "Search", icon: HashIcon },
];

export function CommandListPanel({
  commands,
  ctx,
  services,
  hasQuery,
}: {
  commands: Command[];
  ctx: CommandContext;
  services: CommandServices;
  hasQuery: boolean;
}) {
  const groups = groupCommands(commands);
  const sorted = sortedGroups(groups);

  return (
    <Cmdk.List className="max-h-[min(56vh,24rem)] overflow-y-auto p-1">
      <Cmdk.Empty className="py-6 text-center text-xs text-muted-foreground">
        {hasQuery ? (
          "No commands found."
        ) : (
          <div className="grid grid-cols-2 gap-1.5 px-3">
            {MODE_HINTS.map(({ sigil, label, icon: Icon }) => (
              <div
                key={sigil}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-left"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">{sigil}</span>
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}
      </Cmdk.Empty>

      {sorted.map(([group, cmds]) => (
        <Cmdk.Group key={group}>
          {cmds.map((cmd) => {
            const label = resolveLabel(cmd, ctx);
            return (
              <Cmdk.Item
                key={cmd.id}
                value={`${group}: ${label}`}
                keywords={cmd.keywords}
                onSelect={() => cmd.perform(ctx, services)}
                className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-xs transition-colors data-[selected=true]:bg-muted"
              >
                <span>
                  <span className="font-medium text-blue-900 dark:text-blue-50">
                    {group}:
                  </span>{" "}
                  {label}
                </span>
                {cmd.shortcut && <Kbd className="ml-auto">{cmd.shortcut}</Kbd>}
              </Cmdk.Item>
            );
          })}
        </Cmdk.Group>
      ))}
    </Cmdk.List>
  );
}
