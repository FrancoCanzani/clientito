import { motion } from "motion/react";
import type { ComposeInitial } from "@/features/email/mail/shared/types";
import { ComposeBody } from "@/features/email/mail/compose/compose-body";

export function ComposeDockFrame({
  initial,
  collapsed,
  onClose,
  onMinimize,
  onExpand,
  onToggleMode,
}: {
  initial?: ComposeInitial;
  collapsed: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onExpand: () => void;
  onToggleMode: () => void;
}) {
  return (
    <motion.div
      layout
      className="pointer-events-auto overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, width: collapsed ? 280 : 480 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      <ComposeBody
        initial={initial}
        onClose={onClose}
        onMinimize={collapsed ? onExpand : onMinimize}
        onToggleMode={onToggleMode}
        mode="dock"
        collapsed={collapsed}
        onExpand={onExpand}
        containerClassName={collapsed ? "" : "h-[min(70vh,560px)]"}
      />
    </motion.div>
  );
}
