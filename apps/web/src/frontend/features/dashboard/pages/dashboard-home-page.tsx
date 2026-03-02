import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/api";
import { DashboardBriefingStream } from "@/features/dashboard/components/dashboard-briefing-stream";
import { getGreeting } from "@/features/dashboard/utils";
import { formatInboxRowDate } from "@/features/emails/utils";
import { getRouteApi, Link } from "@tanstack/react-router";
import { format } from "date-fns";

const homeRoute = getRouteApi("/_dashboard/home");

export default function DashboardHomePage() {
  const { unreadPrimaryEmails, tasksForToday } = homeRoute.useLoaderData();
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <h2 className="text-xl font-medium tracking-tight">
        {getGreeting()}
        {firstName ? `, ${firstName}` : ""}
      </h2>

      <DashboardBriefingStream />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h3 className="font-medium">Unread emails</h3>
          <Button asChild variant="ghost" size="sm">
            <Link to="/emails">Open inbox</Link>
          </Button>
        </div>

        {unreadPrimaryEmails.data.length > 0 ? (
          <div className="space-y-1">
            {unreadPrimaryEmails.data.map((email) => (
              <div
                key={email.id}
                className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5 hover:bg-muted/40"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-blue-500"
                    aria-label="Unread"
                    title="Unread"
                  />
                  <p className="max-w-44 truncate text-sm font-medium">
                    {email.fromName || email.fromAddr}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {email.subject ?? "(no subject)"}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {formatInboxRowDate(email.date)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            No unread emails in Primary.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Tasks for today</h3>

        {tasksForToday.length > 0 ? (
          <div className="space-y-1">
            {tasksForToday.map((task) => (
              <div
                key={task.id}
                className="flex items-start justify-between gap-4 rounded-md px-1.5 py-1.5 hover:bg-muted/40"
              >
                <p className="min-w-0 text-sm leading-relaxed">
                  {task.title}
                </p>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {format(task.dueAt, "p")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            No tasks due today.
          </p>
        )}
      </section>
    </div>
  );
}
