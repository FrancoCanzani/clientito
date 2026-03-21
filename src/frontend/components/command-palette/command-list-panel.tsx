import { KeyReturnIcon } from "@phosphor-icons/react";
import { Command } from "cmdk";
import type { PaletteCommand } from "./types";
import { commandGroupHeadingClassName } from "./types";

const commandItemClassName =
  "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm transition-colors data-[selected=true]:bg-muted";

function CommandGroup({
  heading,
  commands,
}: {
  heading: string;
  commands: PaletteCommand[];
}) {
  if (commands.length === 0) return null;
  return (
    <Command.Group heading={heading} className={commandGroupHeadingClassName}>
      {commands.map((command) => (
        <Command.Item
          key={command.id}
          value={command.label}
          onSelect={command.onSelect}
          className={commandItemClassName}
        >
          <span className="text-muted-foreground">{command.icon}</span>
          {command.label}
        </Command.Item>
      ))}
    </Command.Group>
  );
}

export function CommandListPanel({
  visibleNavigationCommands,
  emailNavigationCommands,
  taskNavigationCommands,
  emailSelectionCommands,
  actionCommands,
  enterAgentMode,
}: {
  visibleNavigationCommands: PaletteCommand[];
  emailNavigationCommands: PaletteCommand[];
  taskNavigationCommands: PaletteCommand[];
  emailSelectionCommands: PaletteCommand[];
  actionCommands: PaletteCommand[];
  enterAgentMode: (initialQuery?: string) => void;
}) {
  return (
    <div className="max-h-72 overflow-y-auto py-1">
      <Command.List>
        <Command.Empty className="px-3 py-3 text-sm text-muted-foreground">
          No commands found.
        </Command.Empty>

        <CommandGroup heading="Mailbox" commands={emailNavigationCommands} />
        <CommandGroup heading="Task Views" commands={taskNavigationCommands} />
        <CommandGroup
          heading="Navigation"
          commands={visibleNavigationCommands}
        />
        <CommandGroup heading="Select" commands={emailSelectionCommands} />
        <CommandGroup heading="Actions" commands={actionCommands} />

        <Command.Group
          heading="Agent"
          className={commandGroupHeadingClassName}
        >
          <Command.Item
            value="Ask agent"
            keywords={["agent", "assistant", "ai", "chat"]}
            onSelect={() => enterAgentMode()}
            className={commandItemClassName}
          >
            <KeyReturnIcon className="size-4 text-muted-foreground" />
            Ask agent
          </Command.Item>
        </Command.Group>
      </Command.List>
    </div>
  );
}
