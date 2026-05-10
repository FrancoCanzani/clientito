import { useShortcuts } from "@/hooks/use-shortcuts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveMode, MODE_PLACEHOLDERS } from "./modes/resolve-mode";
import type { InputMode } from "./modes/types";
import type { PaletteMode } from "./types";

export function useCommandPaletteState() {
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("commands");
  const [query, setQuery] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setMode("commands");
  }, []);

  useShortcuts(
    "global",
    {
      "global:command-palette": () => setOpen(true),
      "action:esc": {
        action: () => {
          setOpen(false);
          setQuery("");
          setMode("commands");
        },
        enabled: open,
      },
    },
    { allowInEditable: true },
  );

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [mode, open]);

  const { mode: inputMode, query: modeQuery } = useMemo(
    (): { mode: InputMode; query: string } => resolveMode(query),
    [query],
  );

  const inputPlaceholder = MODE_PLACEHOLDERS[inputMode];

  return {
    inputRef,
    containerRef,
    isMobile,
    open,
    setOpen,
    mode,
    setMode,
    query,
    setQuery,
    inputMode,
    modeQuery,
    inputPlaceholder,
    close,
  };
}
