import { NotePencilIcon } from "@phosphor-icons/react";
import { openScratchpad } from "@/features/scratchpad/scratchpad-events";
import { shortcutKey } from "@/lib/shortcuts";
import { paletteIcon } from "../registry/palette-icon";
import { registerCommands } from "../registry/registry";
import type { Command } from "../registry/types";

const scratchpadCommands: Command[] = [
  {
    id: "scratchpad:open",
    label: "Open scratchpad",
    icon: paletteIcon(NotePencilIcon),
    group: "actions",
    shortcut: shortcutKey("global:scratchpad"),
    keywords: ["scratchpad", "note", "paste", "sketch", "write"],
    perform: (_ctx, services) => {
      openScratchpad();
      services.close();
    },
  },
];

registerCommands(scratchpadCommands);
