import { motion } from "motion/react";
import type { ComposeInitial } from "../types";
import { ComposeBody } from "./compose-body";

export function ComposeModalFrame({
  initial,
  onClose,
  onToggleMode,
}: {
  initial?: ComposeInitial;
  onClose: () => void;
  onToggleMode: () => void;
}) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-[oklch(12%_0.01_250)]/25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onToggleMode}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-160"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.15 }}
      >
        <ComposeBody
          initial={initial}
          onClose={onClose}
          onToggleMode={onToggleMode}
          mode="modal"
          containerClassName="max-h-[min(85vh,720px)] sm:max-h-[70vh]"
        />
      </motion.div>
    </>
  );
}
