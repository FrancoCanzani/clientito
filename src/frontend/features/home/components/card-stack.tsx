import type { HomeBriefingItem } from "@/features/home/queries";
import { TriageCard } from "@/features/home/components/triage-card";
import { AnimatePresence, motion } from "motion/react";

export function CardStack({
  items,
  activeIndex,
  drafts,
  isLoadingDrafts,
  editingId,
  sendingId,
  onDismiss,
  onSendReply,
  onArchive,
  onDraftChange,
  onToggleEdit,
}: {
  items: HomeBriefingItem[];
  activeIndex: number;
  drafts: Record<string, string>;
  isLoadingDrafts: boolean;
  editingId: string | null;
  sendingId: string | null;
  onDismiss: (id: string) => void;
  onSendReply: (id: string) => void;
  onArchive: (id: string) => void;
  onDraftChange: (id: string, text: string) => void;
  onToggleEdit: () => void;
}) {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => {
          const isActive = i === activeIndex;

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, x: -40 }}
              transition={{
                layout: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
                scale: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
                opacity: { duration: 0.2 },
              }}
              className={`group rounded-lg border bg-card p-2 ${
                isActive
                  ? "border-primary/40 ring-1 ring-primary/20"
                  : "border-border"
              }`}
            >
              <TriageCard
                item={item}
                isActive={isActive}
                draft={drafts[item.id]}
                isLoadingDraft={isLoadingDrafts}
                isEditing={editingId === item.id}
                isSending={sendingId === item.id}
                onDismiss={onDismiss}
                onSendReply={onSendReply}
                onArchive={onArchive}
                onDraftChange={onDraftChange}
                onToggleEdit={onToggleEdit}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
