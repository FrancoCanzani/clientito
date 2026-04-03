import { TriageCard } from "@/features/home/components/triage-card";
import type { useDecisionQueue } from "@/features/home/hooks/use-decision-queue";

export type DecisionQueue = ReturnType<typeof useDecisionQueue>;

export function CardStack({ queue }: { queue: DecisionQueue }) {
  return (
    <div className="space-y-3">
      {queue.visibleItems.map((item, i) => {
        const isActive = i === queue.activeIndex;

        return (
          <div
            key={item.id}
            onMouseDown={() => queue.setActiveIndex(i)}
            onFocusCapture={() => queue.setActiveIndex(i)}
          >
            <TriageCard item={item} queue={queue} isActive={isActive} />
          </div>
        );
      })}
    </div>
  );
}
