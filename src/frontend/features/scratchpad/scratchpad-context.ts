import { createContext, useContext } from "react";
import { openScratchpad as emitOpenScratchpad } from "./scratchpad-events";

export type ScratchpadContextValue = {
  open: boolean;
  openScratchpad: () => void;
  closeScratchpad: () => void;
};

export const ScratchpadContext =
  createContext<ScratchpadContextValue | null>(null);

export function useScratchpad() {
  const context = useContext(ScratchpadContext);
  return (
    context ?? {
      open: false,
      openScratchpad: emitOpenScratchpad,
      closeScratchpad: () => {},
    }
  );
}
