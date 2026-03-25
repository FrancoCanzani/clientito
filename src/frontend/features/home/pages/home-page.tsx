import { Kbd } from "@/components/ui/kbd";
import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefingText } from "@/features/home/components/briefing-text";
import { CardStack } from "@/features/home/components/card-stack";
import { useDecisionKeyboard } from "@/features/home/hooks/use-decision-keyboard";
import { useDecisionQueue } from "@/features/home/hooks/use-decision-queue";
import { useBriefingStream } from "@/features/home/hooks/use-briefing-stream";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

const homeRoute = getRouteApi("/_dashboard/home");

export default function HomePage() {
  const briefing = homeRoute.useLoaderData();
  const { user } = useAuth();
  const router = useRouter();
  const greeting = getGreeting(user?.name, briefing);
  const hasItems = briefing.items.length > 0;
  const stream = useBriefingStream(hasItems && !briefing.text);
  const briefingText = briefing.text || stream.text;

  const shouldShowBriefingSkeleton = hasItems && !briefingText && !stream.error;
  const isAnimating = stream.isStreaming;

  const queue = useDecisionQueue(briefing.items);
  const isHomeRoute = router.state.location.pathname === "/home";

  const sendActiveReply = useCallback(() => {
    if (queue.activeItem) queue.sendReply(queue.activeItem.id);
  }, [queue]);

  const skipActive = useCallback(() => {
    if (queue.activeItem) queue.dismiss(queue.activeItem.id);
  }, [queue]);

  const archiveActive = useCallback(() => {
    if (queue.activeItem) queue.archiveItem(queue.activeItem.id);
  }, [queue]);

  useDecisionKeyboard({
    navigateUp: queue.navigateUp,
    navigateDown: queue.navigateDown,
    toggleEditing: queue.toggleEditing,
    cancelEditing: queue.cancelEditing,
    sendActiveReply,
    skipActive,
    archiveActive,
    enabled: isHomeRoute,
  });

  const showCards =
    queue.visibleItems.length > 0 && !isAnimating && briefingText;
  const showCaughtUpState = queue.visibleItems.length === 0 && !isAnimating;

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
        <CardStack
          items={queue.visibleItems}
          activeIndex={queue.activeIndex}
          drafts={queue.drafts}
          isLoadingDrafts={queue.isLoadingDrafts}
          editingId={queue.editingId}
          sendingId={queue.sendingId}
          onDismiss={queue.dismiss}
          onSendReply={queue.sendReply}
          onArchive={queue.archiveItem}
          onDraftChange={queue.updateDraft}
          onToggleEdit={queue.toggleEditing}
        />
      )}

      {showCards && (
        <div className="mt-auto flex items-center justify-between pt-4 text-[11px] text-muted-foreground">
          <span>{queue.visibleItems.length} items remaining</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>E</Kbd>
              edit
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Enter</Kbd>
              send
            </span>
            <span className="flex items-center gap-1">
              <Kbd>S</Kbd>
              skip
            </span>
            <span className="flex items-center gap-1">
              <Kbd>A</Kbd>
              archive
            </span>
          </div>
        </div>
      )}

      {showCaughtUpState && (
        <Empty className="min-h-[60vh] border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>{greeting.line}</EmptyTitle>
            <EmptyDescription>
              Everything looks handled. No recent action-needed threads or
              overdue tasks right now.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
