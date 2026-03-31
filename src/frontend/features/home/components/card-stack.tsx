import { TriageCard } from "@/features/home/components/triage-card";
import type { useDecisionQueue } from "@/features/home/hooks/use-decision-queue";
import { AnimatePresence, motion } from "motion/react";

export function CardStack({
  queue,
}: {
  queue: ReturnType<typeof useDecisionQueue>;
}) {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {queue.visibleItems.map((item, i) => {
          const isActive = i === queue.activeIndex;

          return (
            <motion.div
              key={item.id}
              layout
              onMouseDown={() => queue.setActiveIndex(i)}
              onFocusCapture={() => queue.setActiveIndex(i)}
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
                draft={queue.drafts[item.id]}
                isLoadingDraft={queue.isLoadingDrafts}
                isEditing={queue.editingId === item.id}
                isSending={queue.sendingId === item.id}
                onDismiss={queue.dismiss}
                onSendReply={queue.sendReply}
                onArchive={queue.archiveItem}
                onDraftChange={queue.updateDraft}
                onToggleEdit={() => queue.toggleEditing(item.id)}
                onApproveEvent={queue.approveEvent}
                onDismissEvent={queue.dismissEvent}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
