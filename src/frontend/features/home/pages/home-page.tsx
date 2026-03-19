import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { type HomeBriefingItem } from "@/features/home/queries";
import { getGreeting } from "@/features/home/utils";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  ChatCircleDotsIcon,
  CheckSquareIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
} from "@phosphor-icons/react";
import { getRouteApi } from "@tanstack/react-router";

const homeRoute = getRouteApi("/_dashboard/home");

function isEmailItem(item: HomeBriefingItem) {
  return item.type === "reply" || item.type === "fyi";
}

function isTaskItem(item: HomeBriefingItem) {
  return item.type === "overdue_task" || item.type === "due_today_task";
}

function getTimeLabel(reason: string) {
  const match = reason.match(/(\d+\s\w+\sago|just now)/i);
  return match?.[0] ?? "";
}

function EmailItemRow({
  item,
  onClick,
}: {
  item: HomeBriefingItem;
  onClick: () => void;
}) {
  const time = getTimeLabel(item.reason);
  const subject =
    item.reason.match(/"([^"]+)"/)?.[1] ?? item.reason.replace(/[."]/g, "").trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted/40"
    >
      <div className="mt-0.5 shrink-0">
        {item.type === "reply" ? (
          <ChatCircleDotsIcon className="size-4 text-foreground" />
        ) : (
          <EyeIcon className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {time && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {time}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{subject}</p>
      </div>
      {item.type === "fyi" && (
        <span className="mt-0.5 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          FYI
        </span>
      )}
    </button>
  );
}

function TaskItemRow({
  item,
  onClick,
}: {
  item: HomeBriefingItem;
  onClick: () => void;
}) {
  const isOverdue = item.type === "overdue_task";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted/40"
    >
      <CheckSquareIcon
        className={cn(
          "size-4 shrink-0",
          isOverdue ? "text-red-500" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm",
            isOverdue ? "font-medium text-red-600" : "text-foreground",
          )}
        >
          {item.title}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-[11px]",
          isOverdue ? "text-red-500" : "text-muted-foreground",
        )}
      >
        {isOverdue ? "Overdue" : "Today"}
      </span>
    </button>
  );
}

export default function HomePage() {
  const navigate = homeRoute.useNavigate();
  const briefing = homeRoute.useLoaderData();
  const { user } = useAuth();
  const greeting = getGreeting(user?.name, briefing);

  const emailItems = briefing.items.filter(isEmailItem);
  const taskItems = briefing.items.filter(isTaskItem);

  const navigateToItem = (item: HomeBriefingItem) => {
    if (item.href.startsWith("/inbox?id=")) {
      const id = item.href.split("=")[1];
      navigate({ to: "/inbox", search: { view: "inbox", id } });
      return;
    }
    navigate({ to: "/tasks" });
  };

  const hasItems = briefing.items.length > 0;

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-xl font-medium">{greeting.line}</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          {briefing.text}
        </p>
      </header>

      {hasItems ? (
        <div className="space-y-6">
          {emailItems.length > 0 && (
            <section className="space-y-1">
              <div className="flex items-center justify-between px-3 pb-1">
                <div className="flex items-center gap-1.5">
                  <EnvelopeSimpleIcon className="size-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-medium text-muted-foreground">
                    Emails
                  </h2>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                  onClick={() => navigate({ to: "/inbox" })}
                >
                  Open inbox
                  <ArrowRightIcon className="size-3" />
                </button>
              </div>
              <div className="rounded-lg border border-border/60">
                {emailItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={cn(i > 0 && "border-t border-border/40")}
                  >
                    <EmailItemRow
                      item={item}
                      onClick={() => navigateToItem(item)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {taskItems.length > 0 && (
            <section className="space-y-1">
              <div className="flex items-center justify-between px-3 pb-1">
                <div className="flex items-center gap-1.5">
                  <CheckSquareIcon className="size-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-medium text-muted-foreground">
                    Tasks
                  </h2>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                  onClick={() => navigate({ to: "/tasks" })}
                >
                  Open tasks
                  <ArrowRightIcon className="size-3" />
                </button>
              </div>
              <div className="rounded-lg border border-border/60">
                {taskItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={cn(i > 0 && "border-t border-border/40")}
                  >
                    <TaskItemRow
                      item={item}
                      onClick={() => navigateToItem(item)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
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
