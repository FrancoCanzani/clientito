import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { type HomeBriefingItem } from "@/features/home/queries";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { getRouteApi } from "@tanstack/react-router";

const homeRoute = getRouteApi("/_dashboard/home");

function getItemTypeLabel(item: HomeBriefingItem) {
  switch (item.type) {
    case "reply":
      return "Reply";
    case "overdue_task":
      return "Overdue";
    default:
      return "Today";
  }
}

export default function HomePage() {
  const navigate = homeRoute.useNavigate();
  const briefing = homeRoute.useLoaderData();
  const { user } = useAuth();
  const greeting = getGreeting(user?.name, briefing);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="space-y-1.5">
          <h1 className="text-xl font-medium">{greeting.line}</h1>
          <p className="text-pretty text-sm text-muted-foreground">
            {briefing.text}
          </p>
        </div>
      </header>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-tight">To review</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/inbox" })}
            >
              Open inbox
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/tasks" })}
            >
              Open tasks
            </Button>
          </div>
        </div>

        {briefing.items.length > 0 ? (
          <div className="divide-y divide-border/60">
            {briefing.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.href.startsWith("/inbox?id=")) {
                    const id = item.href.split("=")[1];
                    navigate({
                      to: "/inbox",
                      search: { view: "inbox", id },
                    });
                    return;
                  }

                  navigate({ to: "/tasks" });
                }}
                className="flex w-full items-start justify-between gap-4 rounded-md px-2 py-3 text-left transition hover:bg-muted/40"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <span className="text-xs">{getItemTypeLabel(item)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty className="min-h-52 border-border/60">
            <EmptyHeader>
              <EmptyTitle>Everything looks handled.</EmptyTitle>
              <EmptyDescription>
                No recent reply-needed threads or overdue task work is waiting
                right now.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  );
}
