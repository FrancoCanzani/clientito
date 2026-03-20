import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefingText } from "@/features/home/components/briefing-text";
import { useBriefingStream } from "@/features/home/hooks/use-briefing-stream";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";

const homeRoute = getRouteApi("/_dashboard/home");

export default function HomePage() {
  const briefing = homeRoute.useLoaderData();
  const { user } = useAuth();
  const greeting = getGreeting(user?.name, briefing);
  const stream = useBriefingStream();

  const hasItems = briefing.items.length > 0;

  useEffect(() => {
    if (hasItems) {
      stream.trigger();
    }
  }, [hasItems, stream.trigger]);

  const shouldShowBriefingSkeleton = hasItems && !stream.text && !stream.error;
  const isAnimating = stream.isStreaming;

  return (
    <div className="mx-auto flex w-full pt-30 max-w-lg flex-1 flex-col justify-start space-y-6">
      <div className="space-y-3">
        <h1 className="text-xl font-medium">{greeting.line}</h1>
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
        ) : stream.text ? (
          <BriefingText text={stream.text} animate={isAnimating} />
        ) : stream.error ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Today&apos;s briefing couldn&apos;t load right now.
          </p>
        ) : null}
      </div>

      {!hasItems && !stream.isStreaming && (
        <Empty className="min-h-52 border-border/60">
          <EmptyHeader>
            <EmptyTitle>Everything looks handled.</EmptyTitle>
            <EmptyDescription>
              No recent reply-needed threads or overdue tasks right now.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
