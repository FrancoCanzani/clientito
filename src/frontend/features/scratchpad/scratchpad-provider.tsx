import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShortcuts } from "@/hooks/use-shortcuts";
import {
  ScratchpadContext,
  type ScratchpadContextValue,
} from "./scratchpad-context";
import { registerOpenScratchpadListener } from "./scratchpad-events";
import { ScratchpadWindow } from "./scratchpad-window";

export function ScratchpadProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openScratchpad = useCallback(() => setOpen(true), []);
  const closeScratchpad = useCallback(() => setOpen(false), []);

  useEffect(
    () => registerOpenScratchpadListener(() => setOpen(true)),
    [],
  );

  useShortcuts(
    "global",
    {
      "global:scratchpad": () => setOpen(true),
    },
    { allowInEditable: true },
  );

  const value = useMemo<ScratchpadContextValue>(
    () => ({ open, openScratchpad, closeScratchpad }),
    [closeScratchpad, open, openScratchpad],
  );

  return (
    <ScratchpadContext.Provider value={value}>
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(<ScratchpadWindow onClose={closeScratchpad} />, document.body)
        : null}
    </ScratchpadContext.Provider>
  );
}
