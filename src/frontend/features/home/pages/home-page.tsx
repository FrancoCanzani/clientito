import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { AgendaPanel } from "@/features/calendar/components/agenda-panel";
import { BriefingText } from "@/features/home/components/briefing-text";
import { CardStack } from "@/features/home/components/card-stack";
import { useBriefingStream } from "@/features/home/hooks/use-briefing-stream";
import { useDecisionQueue } from "@/features/home/hooks/use-decision-queue";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { useHomeHotkeys } from "@/lib/hotkeys/home-hotkeys";
import { useHotkeyScope } from "@/lib/hotkeys/use-scope";
import { getRouteApi } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";

const homeRoute = getRouteApi("/_dashboard/$mailboxId/home");

export default function HomePage() {
  const { briefing, events } = homeRoute.useLoaderData();
  const { mailboxId } = homeRoute.useParams();
  const { user } = useAuth();
  const greeting = getGreeting(user?.name);
  const hasItems = briefing.items.length > 0;
  const stream = useBriefingStream(mailboxId, hasItems && !briefing.text);
  const briefingText = briefing.text || stream.text;

  const queue = useDecisionQueue(briefing.items);

  useHotkeyScope("home");
  useHomeHotkeys({
    navigateUp: queue.navigateUp,
    navigateDown: queue.navigateDown,
    toggleEditing: queue.toggleEditing,
    cancelEditing: queue.cancelEditing,
    confirm: queue.confirmActive,
    skip: queue.skipActive,
    archiveCard: queue.archiveActive,
  });

  const isAnimating = stream.isStreaming;
  const showCards =
    queue.visibleItems.length > 0 && !isAnimating && briefingText;
  const showCaughtUp = !hasItems && !isAnimating;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6">
      <PageHeader title={greeting} />

      {!showCaughtUp && (
        <AnimatePresence mode="wait">
          {briefingText && (
            <motion.div
              key="briefing"
              initial={isAnimating ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1 }}
            >
              <BriefingText text={briefingText} animate={isAnimating} />
            </motion.div>
          )}
          {!briefingText && stream.error && (
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
          )}
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

      <AgendaPanel
        events={events}
        showEmptyState={false}
        hideProposed
        showHeader
      />

      {showCards && (
        <div className="md:flex hidden items-center justify-between pt-1 text-xs text-muted-foreground">
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

      {showCards && <CardStack queue={queue} />}
    </div>
  );
}
