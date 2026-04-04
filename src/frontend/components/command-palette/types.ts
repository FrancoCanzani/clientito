import type { ReactNode } from "react";

export interface PaletteCommand {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

export type PaletteMode = "commands" | "agent";
