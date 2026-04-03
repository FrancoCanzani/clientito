import type { HomeBriefingItem } from "@/features/home/queries";
import { TriageCard } from "@/features/home/components/triage-card";
import type { useDecisionQueue } from "@/features/home/hooks/use-decision-queue";
import { AnimatePresence, motion } from "motion/react";

const SECTION_LABELS: Partial<Record<string, string>> = {
  email_action: "Needs reply",
  briefing_email: "Emails",
  tasks: "Tasks",
  calendar_suggestion: "Calendar",
};

function getSectionKey(type: HomeBriefingItem["type"]) {
  if (type === "overdue_task" || type === "due_today_task") return "tasks";
  return type;
}

export type DecisionQueue = ReturnType<typeof useDecisionQueue>;

export function CardStack({ queue }: { queue: DecisionQueue }) {
  const seenSections = new Set<string>();

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {queue.visibleItems.map((item, i) => {
          const isActive = i === queue.activeIndex;
          const sectionKey = getSectionKey(item.type);
          const showSectionLabel = !seenSections.has(sectionKey);
          seenSections.add(sectionKey);

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
            >
              {showSectionLabel && SECTION_LABELS[sectionKey] && (
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  {SECTION_LABELS[sectionKey]}
                </p>
              )}
              <div
                className={`group rounded-[24px] transition-shadow duration-150 ease-out ${
                  isActive
                    ? "shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
                    : "shadow-none"
                }`}
              >
                <TriageCard item={item} queue={queue} isActive={isActive} />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
