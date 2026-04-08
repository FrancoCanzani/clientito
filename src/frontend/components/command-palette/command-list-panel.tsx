import { KeyReturnIcon } from "@phosphor-icons/react";
import { Command } from "cmdk";
import type { PaletteCommand } from "./types";

function CommandGroup({
  heading,
  commands,
}: {
  heading: string;
  commands: PaletteCommand[];
}) {
  if (commands.length === 0) return null;
  return (
    <Command.Group
      heading={heading}
      className="**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:capitalize **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground"
    >
      {commands.map((command) => (
        <Command.Item
          key={command.id}
          value={command.label}
          onSelect={command.onSelect}
          className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted"
        >
          <span className="text-muted-foreground">{command.icon}</span>
          <span>{command.label}</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}

export function CommandListPanel({
  visibleNavigationCommands,
  accountCommands,
  actionCommands,
  enterAgentMode,
}: {
  visibleNavigationCommands: PaletteCommand[];
  accountCommands: PaletteCommand[];
  actionCommands: PaletteCommand[];
  enterAgentMode: (initialQuery?: string) => void;
}) {
  return (
    <div className="max-h-72 overflow-y-auto py-2">
      <Command.List>
        <Command.Empty className="px-3 py-2 text-xs text-center text-muted-foreground">
          No commands found.
        </Command.Empty>

        <CommandGroup heading="Accounts" commands={accountCommands} />
        <CommandGroup
          heading="Navigation"
          commands={visibleNavigationCommands}
        />

        <Command.Group
          heading="Agent"
          className="**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:capitalize **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground"
        >
          <Command.Item
            value="Ask agent"
            keywords={["agent", "assistant", "ai", "chat"]}
            onSelect={() => enterAgentMode()}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted"
          >
            <KeyReturnIcon className="size-4 text-muted-foreground" />
            Ask agent
          </Command.Item>
        </Command.Group>

        <CommandGroup heading="Actions" commands={actionCommands} />
      </Command.List>
    </div>
  );
}
