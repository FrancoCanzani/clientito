import { useCallback, useRef } from "react";
import { toast } from "sonner";

const UNDO_DELAY_MS = 5_000;

type UndoSendOptions = {
  onSend: () => Promise<unknown>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Returns a `trigger` function that starts an undo-send countdown.
 * The actual send happens after UNDO_DELAY_MS unless the user cancels.
 */
export function useUndoSend({ onSend, onSuccess, onError }: UndoSendOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const pendingRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = false;
  }, []);

  const trigger = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    cancelledRef.current = false;

    const toastId = toast("Sending email...", {
      duration: UNDO_DELAY_MS + 500,
      action: {
        label: "Undo",
        onClick: () => {
          cancel();
          toast.dismiss(toastId);
          toast("Send cancelled");
        },
      },
    });

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      if (cancelledRef.current) {
        pendingRef.current = false;
        return;
      }

      toast.dismiss(toastId);

      try {
        await onSend();
        pendingRef.current = false;
        onSuccess?.();
      } catch (error) {
        pendingRef.current = false;
        const err = error instanceof Error ? error : new Error("Failed to send email");
        onError?.(err);
      }
    }, UNDO_DELAY_MS);
  }, [onSend, onSuccess, onError, cancel]);

  return { trigger, cancel, isPending: pendingRef };
}
