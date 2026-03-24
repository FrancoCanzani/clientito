import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefingText } from "@/features/home/components/briefing-text";
import { TriageCard } from "@/features/home/components/triage-card";
import { useBriefingStream } from "@/features/home/hooks/use-briefing-stream";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useState } from "react";

const homeRoute = getRouteApi("/_dashboard/home");

export default function HomePage() {
  const briefing = homeRoute.useLoaderData();
  const { user } = useAuth();
  const greeting = getGreeting(user?.name, briefing);
  const hasItems = briefing.items.length > 0;
  const stream = useBriefingStream(hasItems && !briefing.text);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const briefingText = briefing.text || stream.text;

  const shouldShowBriefingSkeleton = hasItems && !briefingText && !stream.error;
  const isAnimating = stream.isStreaming;

  const visibleItems = briefing.items.filter((item) => !dismissed.has(item.id));
  const showCards = visibleItems.length > 0 && !isAnimating && briefingText;
  const showCaughtUpState = visibleItems.length === 0 && !isAnimating;

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col space-y-6">
      {!showCaughtUpState && <PageHeader title={greeting.line} />}

      {!showCaughtUpState && (
        <div className="space-y-3">
          {shouldShowBriefingSkeleton ? (
            <div className="space-y-2 pt-1">
              <Skeleton className="h-4 w-[88%]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[76%]" />
              <Skeleton className="h-4 w-[50%]" />
              <Skeleton className="h-4 w-[89%]" />
              <Skeleton className="h-4 w-[98%]" />
              <Skeleton className="h-4 w-[72%]" />
            </div>
          ) : briefingText ? (
            <BriefingText text={briefingText} animate={isAnimating} />
          ) : stream.error ? (
            <Empty className="min-h-52 border-0 p-0">
              <EmptyHeader>
                <EmptyTitle>{greeting.line}</EmptyTitle>
                <EmptyDescription>
                  Today&apos;s briefing couldn&apos;t load right now.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </div>
      )}

      {showCards && (
        <div className="space-y-2">
          {visibleItems.map((item, i) => (
            <TriageCard
              key={item.id}
              item={item}
              index={i}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {showCaughtUpState && (
        <Empty className="min-h-[60vh] border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>{greeting.line}</EmptyTitle>
            <EmptyDescription>
              Everything looks handled. No recent reply-needed threads or
              overdue tasks right now.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
