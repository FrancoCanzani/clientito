import type { ReactNode } from "react";

export interface PaletteCommand {
  id: string;
  label: string;
  section: string;
  icon: ReactNode;
  shortcut?: string;
  onSelect: () => void;
  to?: string;
}

export type PaletteMode = "commands" | "agent" | "new-task";

export const commandGroupHeadingClassName =
  "**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted-foreground";

export function getAgentStatusLabel(
  status: "ready" | "streaming" | "submitted" | "error",
  isConnected: boolean,
) {
  if (!isConnected) return "Connecting";
  if (status === "submitted") return "Sending request";
  if (status === "streaming") return "Working";
  if (status === "error") return null;
  return null;
}
