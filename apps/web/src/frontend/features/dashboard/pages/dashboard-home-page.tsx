import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getGreeting } from "@/features/dashboard/utils";
import { formatInboxRowDate } from "@/features/emails/utils";
import type { EmailListItem } from "@/features/emails/types";
import type { Person } from "@/features/people/types";
import type { Task } from "@/features/tasks/types";
import { useRouteContext } from "@/hooks/use-page-context";
import { Link, getRouteApi } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2Icon } from "lucide-react";
import type { ReactNode } from "react";

const homeRoute = getRouteApi("/_dashboard/home");

function formatTaskDue(date: number, variant: "today" | "overdue") {
  return format(new Date(date), variant === "today" ? "p" : "MMM d, p");
}

function HomeSection({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-border/60 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium tracking-tight">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

function TaskRow({
  task,
  variant,
  onClick,
}: {
  task: Task;
  variant: "today" | "overdue";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-4 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-muted/40"
    >
      <p className="min-w-0 text-sm leading-relaxed">{task.title}</p>
      <span
        className={`shrink-0 text-xs ${variant === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {task.dueAt ? formatTaskDue(task.dueAt, variant) : "No due date"}
      </span>
    </button>
  );
}

function EmailRow({
  email,
  onClick,
  subtitle,
}: {
  email: EmailListItem;
  onClick: () => void;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-muted/40"
    >
      <div className="min-w-0 flex items-center gap-2">
        {!email.isRead && (
          <span
            className="size-1.5 shrink-0 rounded-full bg-blue-500"
            aria-label="Unread"
            title="Unread"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{subtitle}</p>
          <p className="truncate text-sm text-muted-foreground">
            {email.subject ?? "(no subject)"}
          </p>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {formatInboxRowDate(email.date)}
      </span>
    </button>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-1 text-sm text-muted-foreground">{children}</p>;
}

export default function DashboardHomePage() {
  useRouteContext("/home");
  const navigate = homeRoute.useNavigate();
  const {
    unreadPrimaryEmails,
    unreadPrimaryEmailCount,
    dueTodayTasks,
    dueTodayTaskCount,
    overdueTasks,
    overdueTaskCount,
    staleContacts,
    staleContactCount,
  } = homeRoute.useLoaderData() as {
    unreadPrimaryEmails: EmailListItem[];
    unreadPrimaryEmailCount: number;
    dueTodayTasks: Task[];
    dueTodayTaskCount: number;
    overdueTasks: Task[];
    overdueTaskCount: number;
    staleContacts: Person[];
    staleContactCount: number;
  };
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0];

  const statusItems = [
    overdueTaskCount > 0
      ? {
          key: "overdue",
          label: `${overdueTaskCount} overdue`,
          className:
            "border-destructive/25 bg-destructive/10 text-destructive",
        }
      : null,
    dueTodayTaskCount > 0
      ? {
          key: "today",
          label: `${dueTodayTaskCount} due today`,
          className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
        }
      : null,
    unreadPrimaryEmailCount > 0
      ? {
          key: "emails",
          label: `${unreadPrimaryEmailCount} unread email${unreadPrimaryEmailCount === 1 ? "" : "s"}`,
          className: "border-blue-500/25 bg-blue-500/10 text-blue-700",
        }
      : null,
    staleContactCount > 0
      ? {
          key: "followups",
          label: `${staleContactCount} follow-up${staleContactCount === 1 ? "" : "s"}`,
          className: "border-border bg-muted/60 text-foreground",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    className: string;
  }>;

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Home
          </p>
          <h1 className="text-2xl font-medium tracking-tight">
            {getGreeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>

        {statusItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {statusItems.map((item) => (
              <span
                key={item.key}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${item.className}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 text-emerald-600" />
            <span>All caught up.</span>
          </div>
        )}
      </header>

      <HomeSection
        title="Overdue"
        actionLabel="Open tasks"
        onAction={() => navigate({ to: "/tasks" })}
      >
        {overdueTasks.length > 0 ? (
          <div className="space-y-1">
            {overdueTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                variant="overdue"
                onClick={() => navigate({ to: "/tasks" })}
              />
            ))}
          </div>
        ) : (
          <EmptyState>Nothing overdue.</EmptyState>
        )}
      </HomeSection>

      <HomeSection
        title="Due today"
        actionLabel="Open tasks"
        onAction={() => navigate({ to: "/tasks" })}
      >
        {dueTodayTasks.length > 0 ? (
          <div className="space-y-1">
            {dueTodayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                variant="today"
                onClick={() => navigate({ to: "/tasks" })}
              />
            ))}
          </div>
        ) : (
          <EmptyState>No tasks due today.</EmptyState>
        )}
      </HomeSection>

      <HomeSection
        title="Unread email"
        actionLabel="Open inbox"
        onAction={() =>
          navigate({
            to: "/emails",
            search: { view: "inbox", category: "primary" },
          })
        }
      >
        {unreadPrimaryEmails.length > 0 ? (
          <div className="space-y-1">
            {unreadPrimaryEmails.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                subtitle={email.fromName || email.fromAddr}
                onClick={() =>
                  navigate({
                    to: "/emails",
                    search: {
                      view: "inbox",
                      category: "primary",
                      id: email.id,
                    },
                  })
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState>No unread email in Principal.</EmptyState>
        )}
      </HomeSection>

      <HomeSection
        title="Follow-ups"
        actionLabel="Open people"
        onAction={() => navigate({ to: "/people" })}
      >
        {staleContacts.length > 0 ? (
          <div className="space-y-1">
            {staleContacts.map((person) => (
              <Link
                key={person.id}
                to="/people/$personId"
                params={{ personId: String(person.id) }}
                className="flex items-center justify-between gap-4 rounded-md px-1.5 py-2.5 text-sm transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium">
                    {person.name ?? person.email}
                  </p>
                  {person.name ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {person.email}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {person.lastContactedAt
                    ? formatDistanceToNowStrict(new Date(person.lastContactedAt), {
                        addSuffix: true,
                      })
                    : "Never"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState>No follow-ups pending.</EmptyState>
        )}
      </HomeSection>
    </div>
  );
}
