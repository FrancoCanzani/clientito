import { TriageCard } from "@/features/home/components/triage-card";
import type { useDecisionQueue } from "@/features/home/hooks/use-decision-queue";
import { useEffect, useRef } from "react";

export type DecisionQueue = ReturnType<typeof useDecisionQueue>;

export function CardStack({ queue }: { queue: DecisionQueue }) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [queue.activeIndex]);

  return (
    <div className="space-y-3">
      {queue.visibleItems.map((item, i) => {
        const isActive = i === queue.activeIndex;

        return (
          <div
            key={item.id}
            ref={isActive ? activeRef : undefined}
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
