import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaPanel } from "@/features/calendar/components/agenda-panel";
import { BriefingText } from "@/features/home/components/briefing-text";
import { CardStack } from "@/features/home/components/card-stack";
import { useBriefingStream } from "@/features/home/hooks/use-briefing-stream";
import { useDecisionKeyboard } from "@/features/home/hooks/use-decision-keyboard";
import { useDecisionQueue } from "@/features/home/hooks/use-decision-queue";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { getRouteApi } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";

const homeRoute = getRouteApi("/_dashboard/home");

export default function HomePage() {
  const briefing = homeRoute.useLoaderData();
  const { user } = useAuth();
  const greeting = getGreeting(user?.name);
  const hasItems = briefing.items.length > 0;
  const stream = useBriefingStream(hasItems && !briefing.text);
  const briefingText = briefing.text || stream.text;

  const queue = useDecisionQueue(briefing.items);

  useDecisionKeyboard({
    navigateUp: queue.navigateUp,
    navigateDown: queue.navigateDown,
    toggleEditing: queue.toggleEditing,
    cancelEditing: queue.cancelEditing,
    sendActiveReply: queue.confirmActive,
    skipActive: queue.skipActive,
    archiveActive: queue.archiveActive,
    enabled: true,
  });

  const isAnimating = stream.isStreaming;
  const showCards = queue.visibleItems.length > 0 && !isAnimating && briefingText;
  const showCaughtUp = !hasItems && !isAnimating;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col space-y-6">
      <PageHeader title={greeting} />

      {!showCaughtUp && (
        <AnimatePresence mode="wait">
          {hasItems && !briefingText && !stream.error ? (
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
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span>Today&apos;s briefing couldn&apos;t load right now.</span>
              <button
                type="button"
                onClick={stream.retry}
                className="text-xs underline underline-offset-2 hover:text-foreground"
              >
                Retry
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}

      {showCaughtUp && (
        <Empty className="min-h-[50vh] flex-1 border-0">
          <EmptyHeader>
            <EmptyTitle>You're all caught up</EmptyTitle>
            <EmptyDescription>
              Nothing needs your attention right now. Items will show up here
              when they need action.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <AgendaPanel days={1} showEmptyState={false} hideProposed showHeader />

      {showCards && <CardStack queue={queue} />}

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
