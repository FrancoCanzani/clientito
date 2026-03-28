import { Kbd } from "@/components/ui/kbd";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaPanel } from "@/features/calendar/components/agenda-panel";
import { BriefingText } from "@/features/home/components/briefing-text";
import { CardStack } from "@/features/home/components/card-stack";
import { useDecisionKeyboard } from "@/features/home/hooks/use-decision-keyboard";
import { useDecisionQueue } from "@/features/home/hooks/use-decision-queue";
import { useBriefingStream } from "@/features/home/hooks/use-briefing-stream";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

const homeRoute = getRouteApi("/_dashboard/home");

export default function HomePage() {
  const briefing = homeRoute.useLoaderData();
  const { user } = useAuth();
  const router = useRouter();
  const greeting = getGreeting(user?.name);
  const hasItems = briefing.items.length > 0;
  const stream = useBriefingStream(hasItems && !briefing.text);
  const briefingText = briefing.text || stream.text;

  const shouldShowBriefingSkeleton = hasItems && !briefingText && !stream.error;
  const isAnimating = stream.isStreaming;

  const queue = useDecisionQueue(briefing.items);
  const isHomeRoute = router.state.location.pathname === "/home";

  const sendActiveReply = useCallback(() => {
    if (!queue.activeItem) return;
    if (queue.activeItem.type === "proposed_event") {
      queue.approveEvent(queue.activeItem.id);
    } else {
      queue.sendReply(queue.activeItem.id);
    }
  }, [queue]);

  const skipActive = useCallback(() => {
    if (!queue.activeItem) return;
    if (queue.activeItem.type === "proposed_event") {
      queue.dismissEvent(queue.activeItem.id);
    } else {
      queue.dismiss(queue.activeItem.id);
    }
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
    <div className="mx-auto flex w-full max-w-3xl flex-col space-y-6">
      {!showCaughtUpState && <PageHeader title={greeting} />}

      {!showCaughtUpState && (
        <AnimatePresence mode="wait">
          {shouldShowBriefingSkeleton ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-2 pt-1"
            >
              <Skeleton className="h-4 w-[88%]" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[76%]" />
              <Skeleton className="h-4 w-[50%]" />
            </motion.div>
          ) : briefingText ? (
            <motion.div
              key="briefing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <BriefingText text={briefingText} animate={isAnimating} />
            </motion.div>
          ) : stream.error ? (
            <motion.p
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-muted-foreground"
            >
              Today&apos;s briefing couldn&apos;t load right now.
            </motion.p>
          ) : null}
        </AnimatePresence>
      )}

      {showCaughtUpState && (
        <div className="space-y-2 pt-2">
          <h2 className="text-lg font-medium">{greeting}</h2>
          <p className="text-sm text-muted-foreground">
            Nothing needs attention right now. Items will show up here as cards.
          </p>
        </div>
      )}

      <AgendaPanel days={1} showEmptyState={false} hideProposed showHeader />

      {showCards && (
        <CardStack queue={queue} />
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
    </div>
  );
}
