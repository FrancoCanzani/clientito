import { useCallback, useRef } from "react";
import { toast } from "sonner";

const UNDO_DELAY_MS = 5_000;

type UndoSendOptions = {
  onSend: () => Promise<unknown>;
  onUndo?: () => void;
  onView?: (result: unknown) => void | Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Returns a `trigger` function that starts an undo-send countdown.
 * The actual send happens after UNDO_DELAY_MS unless the user cancels.
 */
export function useUndoSend({
  onSend,
  onUndo,
  onView,
  onSuccess,
  onError,
}: UndoSendOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const pendingRef = useRef(false);
  const resultRef = useRef<unknown>(null);
  const viewRequestedRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = false;
    onUndo?.();
  }, [onUndo]);

  const trigger = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    cancelledRef.current = false;
    resultRef.current = null;
    viewRequestedRef.current = false;

    const toastId = toast("Email sent", {
      duration: UNDO_DELAY_MS + 500,
      ...(onView
        ? {
            action: {
              label: "View email",
              onClick: () => {
                if (resultRef.current) {
                  void onView(resultRef.current);
                  return;
                }
                viewRequestedRef.current = true;
                toast("Opening when ready...");
              },
            },
            cancel: {
              label: "Undo",
              onClick: () => {
                cancel();
                toast.dismiss(toastId);
                toast("Send cancelled");
              },
            },
          }
        : {
            action: {
              label: "Undo",
              onClick: () => {
                cancel();
                toast.dismiss(toastId);
                toast("Send cancelled");
              },
            },
          }),
    });

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      if (cancelledRef.current) {
        pendingRef.current = false;
        return;
      }

      toast.dismiss(toastId);

      try {
        const result = await onSend();
        resultRef.current = result;
        pendingRef.current = false;
        onSuccess?.();
        if (viewRequestedRef.current && onView) {
          await onView(result);
          return;
        }
        toast.success("Email sent", {
          action: onView
            ? {
                label: "View email",
                onClick: () => void onView(result),
              }
            : undefined,
        });
      } catch (error) {
        pendingRef.current = false;
        const err = error instanceof Error ? error : new Error("Failed to send email");
        onError?.(err);
      }
    }, UNDO_DELAY_MS);
  }, [onSend, onView, onSuccess, onError, cancel]);

  return { trigger, cancel, isPending: pendingRef.current };
}
