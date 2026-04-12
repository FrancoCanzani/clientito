import { useHotkeys } from "@/hooks/use-hotkeys";
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

  useHotkeys(
    {
      "$mod+k": () => setOpen(true),
      Escape: {
        enabled: open,
        onKeyDown: () => {
          setOpen(false);
          setQuery("");
          setMode("commands");
        },
      },
    },
    { allowInEditable: true },
  );

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 0);
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
