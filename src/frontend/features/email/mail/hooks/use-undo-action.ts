import { useCallback, useRef } from "react";
import { toast } from "sonner";

const UNDO_DELAY_MS = 4_000;

type TriggerOptions = {
  action: () => Promise<unknown>;
  onAction?: () => void;
  onUndo?: () => void;
  message: string;
  undoneMessage?: string;
};

/**
 * Returns a stable `trigger(opts)` that starts a 4-second undo countdown.
 * The actual action runs after the delay unless the user presses ↩.
 */
export function useUndoAction() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const trigger = useCallback((opts: TriggerOptions) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    cancelledRef.current = false;

    const toastId = toast(opts.message, {
      duration: UNDO_DELAY_MS + 500,
      action: {
        label: "↩",
        onClick: () => {
          cancelledRef.current = true;
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          toast.dismiss(toastId);
          if (opts.undoneMessage) toast(opts.undoneMessage);
          opts.onUndo?.();
        },
      },
    });

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      if (cancelledRef.current) return;
      try {
        await opts.action();
        opts.onAction?.();
      } catch {
        toast.error("Action failed");
      }
    }, UNDO_DELAY_MS);
  }, []);

  return trigger;
}
