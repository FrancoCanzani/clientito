import { PageHeader } from "@/components/page-header";
import { AgendaPanel } from "@/features/calendar/components/agenda-panel";
import { BriefingText } from "@/features/home/components/briefing-text";
import { useBriefingStream } from "@/features/home/hooks/use-briefing-stream";
import { getGreeting } from "@/features/home/utils";
import type { Task } from "@/features/tasks/types";
import { useAuth } from "@/hooks/use-auth";
import { getRouteApi, Link } from "@tanstack/react-router";
import { motion } from "motion/react";

const homeRoute = getRouteApi("/_dashboard/$mailboxId/home");

export default function HomePage() {
  const { events, dueTodayTasks, overdueTasks } = homeRoute.useLoaderData();
  const { mailboxId } = homeRoute.useParams();
  const { user } = useAuth();
  const greeting = getGreeting(user?.name);
  const stream = useBriefingStream(Number(mailboxId));

  const hasTasks = overdueTasks.length > 0 || dueTodayTasks.length > 0;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6">
      <PageHeader title={greeting} />

      {stream.text && (
        <BriefingText text={stream.text} />
      )}
      {!stream.text && stream.error && (
        <motion.div
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

      <AgendaPanel
        events={events}
        showEmptyState={false}
        hideProposed
        showHeader
      />

      {hasTasks && (
        <TasksPanel
          mailboxId={mailboxId}
          overdueTasks={overdueTasks}
          dueTodayTasks={dueTodayTasks}
        />
      )}
    </div>
  );
}

function TasksPanel({
  mailboxId,
  overdueTasks,
  dueTodayTasks,
}: {
  mailboxId: number;
  overdueTasks: Task[];
  dueTodayTasks: Task[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Tasks</h2>
        <Link
          to="/$mailboxId/tasks"
          params={{ mailboxId }}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="space-y-1">
        {overdueTasks.map((task) => (
          <TaskRow key={task.id} task={task} overdue />
        ))}
        {dueTodayTasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, overdue }: { task: Task; overdue?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
      <div className={`size-1.5 shrink-0 rounded-full ${overdue ? "bg-destructive" : "bg-foreground/40"}`} />
      <span className="min-w-0 flex-1 truncate text-foreground/90">{task.title}</span>
      {overdue && (
        <span className="shrink-0 text-xs text-destructive">Overdue</span>
      )}
    </div>
  );
}
