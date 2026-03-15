import { type HomeBriefing } from "@/features/home/queries";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { getRouteApi } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";

const homeRoute = getRouteApi("/_dashboard/home");

function HomeCard({
  title,
  body,
  onClick,
}: {
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border/70 bg-background px-4 py-4 text-left transition-colors hover:bg-muted/20"
    >
      <div className="space-y-1.5">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </button>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function buildSummaryText(briefing: HomeBriefing) {
  const unreadText =
    briefing.counts.unread > 0
      ? `${formatCount(briefing.counts.unread)} unread email${briefing.counts.unread === 1 ? "" : "s"}`
      : "inbox is clear";

  if (briefing.counts.overdue > 0) {
    return `You have ${unreadText} and ${formatCount(briefing.counts.overdue)} overdue task${briefing.counts.overdue === 1 ? "" : "s"}.`;
  }

  if (briefing.counts.dueToday > 0) {
    return `You have ${unreadText} and ${formatCount(briefing.counts.dueToday)} task${briefing.counts.dueToday === 1 ? "" : "s"} due today.`;
  }

  if (briefing.counts.unread > 0) {
    return `You have ${unreadText} and a clear schedule.`;
  }

  return "Your inbox is clear and your schedule is open.";
}

export default function HomePage() {
  const navigate = homeRoute.useNavigate();
  const briefing = homeRoute.useLoaderData() as HomeBriefing;
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0];
  const lastUpdatedAt = briefing.generatedAt;
  const summaryText = buildSummaryText(briefing);
  const greetingLine = `${getGreeting()}${firstName ? `, ${firstName}` : ""}`;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-3xl flex-col justify-between gap-10">
      <div className="space-y-8">
        <header className="space-y-3 pt-2">
          <h1 className="max-w-2xl text-3xl font-medium tracking-tight text-foreground">
            {greetingLine}
          </h1>
          <p className="max-w-2xl text-base leading-8 text-muted-foreground">
            {summaryText}
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <HomeCard
            title="Inbox"
            body={
              briefing.counts.unread > 0
                ? `${formatCount(briefing.counts.unread)} unread messages waiting.`
                : "Your inbox is quiet right now."
            }
            onClick={() =>
              navigate({
                to: "/inbox",
                search: { view: "inbox" },
              })
            }
          />
          <HomeCard
            title="Tasks"
            body={
              briefing.counts.overdue > 0
                ? `${formatCount(briefing.counts.overdue)} overdue and ${formatCount(briefing.counts.dueToday)} due today.`
                : briefing.counts.dueToday > 0
                  ? `${formatCount(briefing.counts.dueToday)} due today.`
                  : "Nothing on deck right now."
            }
            onClick={() => navigate({ to: "/tasks" })}
          />
          <HomeCard
            title="Notes"
            body="Capture a thought or jump back into your working notes."
            onClick={() => navigate({ to: "/notes" })}
          />
        </section>
      </div>

      <footer className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <span>
          Updated{" "}
          {formatDistanceToNowStrict(new Date(lastUpdatedAt), {
            addSuffix: true,
          })}
        </span>
      </footer>
    </div>
  );
}
