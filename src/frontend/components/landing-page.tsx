import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import { CaretRightIcon, CheckCircleIcon, CircleIcon } from "@phosphor-icons/react";

const SAVED_TIME_POINTS = [
  {
    title: "Work the inbox once",
    description:
      "Reply-needed threads, notes, and next actions stay together instead of being rebuilt from memory.",
  },
  {
    title: "Stop losing context",
    description:
      "Customer details live beside the conversation, so handoffs and follow-ups take less rereading.",
  },
  {
    title: "Turn follow-up into a system",
    description:
      "Tasks come out of real customer work, which means fewer dropped promises and fewer late callbacks.",
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const primaryCtaTo = isAuthenticated ? "/home" : "/login";
  const primaryCtaLabel = isAuthenticated ? "Open app" : "Log in";

  return (
    <main className="min-h-screen bg-background text-foreground subpixel-antialiased">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between py-5 sm:py-6">
          <Link
            to="/"
            className="text-sm font-medium tracking-[-0.02em] text-foreground"
          >
            Petit
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 px-3">
              <Link to="/docs">Docs</Link>
            </Button>
            <Button asChild size="sm" className="h-8 px-3">
              <Link to={primaryCtaTo}>{primaryCtaLabel}</Link>
            </Button>
          </div>
        </header>

        <section className="border-t border-border py-11 sm:py-14">
          <div className="max-w-[46rem]">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Regain life hours
            </p>

            <h1 className="mt-4 max-w-[42rem] text-[2.35rem] leading-[0.98] font-medium tracking-[-0.065em] text-foreground sm:text-[4rem]">
              Get hours back from customer follow-up.
            </h1>

            <p className="mt-4 max-w-[38rem] text-[0.98rem] leading-7 text-muted-foreground sm:text-[1.06rem]">
              Petit keeps email, notes, and tasks in one quiet workspace so
              your team spends less time triaging, less time rereading threads,
              and more time finishing the actual work.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-10 rounded-lg px-4 text-sm">
                <Link to={primaryCtaTo}>{primaryCtaLabel}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-10 rounded-lg px-4 text-sm"
              >
                <Link to="/docs">Read docs</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="pb-10 sm:pb-14">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Today
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  2 reply-needed
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Clear the day in one pass
              </span>
            </div>

            <div className="border-b border-border px-4 py-4">
              <p className="max-w-3xl text-[0.96rem] leading-7 text-foreground">
                Two customers need a response before noon. One shipment lane
                still needs pricing confirmation. The renewal follow-up is
                already queued for later today.
              </p>
            </div>

            <div className="px-2 py-2">
              <PreviewRow
                title="Rate quote for ATL -> MIA"
                description="Needs reply today"
                badge="Urgent"
              />
              <PreviewRow
                title="Pickup delayed 45 minutes"
                description="Waiting on confirmation"
                badge="Follow-up"
              />
              <PreviewRow
                title="Northway renewal call"
                description="Task already attached"
                badge="Tracked"
              />
            </div>

            <div className="grid border-t border-border md:grid-cols-2">
              <div className="border-b border-border px-4 py-4 md:border-r md:border-b-0">
                <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  Notes
                </p>
                <div className="mt-3 space-y-2">
                  <InlineNote text="Northway prefers WhatsApp for pickup changes." />
                  <InlineNote text="Atlas wants quote revisions in the same thread." />
                </div>
              </div>

              <div className="px-4 py-4">
                <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  Follow-ups
                </p>
                <div className="mt-3 space-y-2">
                  <TaskLine text="Call Northway by 4pm" />
                  <TaskLine text="Send revised ATL -> MIA quote" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-10 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Where the hours go back
              </p>
              <h2 className="mt-3 max-w-md text-[1.9rem] leading-tight font-medium tracking-[-0.05em] text-foreground">
                Less churn. Fewer missed follow-ups. More finished days.
              </h2>
            </div>

            <div className="divide-y divide-border border-y border-border">
              {SAVED_TIME_POINTS.map((item) => (
                <article
                  key={item.title}
                  className="grid gap-2 py-5 sm:grid-cols-[190px_1fr]"
                >
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="max-w-xl text-[0.95rem] leading-7 text-muted-foreground">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-auto flex flex-col gap-4 border-t border-border py-6 text-[0.92rem] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>A calmer system for customer email, notes, and follow-up.</p>
          <div className="flex items-center gap-4">
            <Link to="/docs" className="transition-colors hover:text-foreground">
              Docs
            </Link>
            <Link
              to={primaryCtaTo}
              className="transition-colors hover:text-foreground"
            >
              {primaryCtaLabel}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function PreviewRow(props: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-muted/35">
      <span className="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.92rem] font-medium text-foreground">
          {props.title}
        </p>
        <p className="mt-0.5 text-[0.92rem] text-muted-foreground">
          {props.description}
        </p>
      </div>

      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {props.badge}
      </span>
    </div>
  );
}

function InlineNote(props: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-[0.92rem] text-foreground/88">
      <CircleIcon className="mt-[0.35rem] size-2.5 shrink-0 fill-current text-muted-foreground" weight="fill" />
      <p className="leading-6">{props.text}</p>
    </div>
  );
}

function TaskLine(props: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-1 text-[0.92rem] text-foreground/88">
      <CheckCircleIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="leading-6">{props.text}</span>
      <CaretRightIcon className="ml-auto size-3.5 text-muted-foreground" />
    </div>
  );
}
