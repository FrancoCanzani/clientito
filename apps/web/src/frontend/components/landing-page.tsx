import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/api/auth-api";
import { Link } from "@tanstack/react-router";

const FEATURE_ITEMS = [
  {
    title: "Schedule every release",
    description: "Set publish windows and keep rollout timing predictable.",
  },
  {
    title: "Guide adoption",
    description: "Attach launch checklists so users actually see what changed.",
  },
  {
    title: "Target precisely",
    description: "Deliver updates by user traits, plan, and behavior.",
  },
  {
    title: "Measure impact",
    description: "Track impressions and completion signals in one place.",
  },
  {
    title: "Integrate your stack",
    description: "Connect Slack, GitHub, or custom webhooks in minutes.",
  },
  {
    title: "Stay lightweight",
    description: "Clean UI, minimal setup, and no dashboard clutter.",
  },
];

const PLANS = [
  {
    name: "Basic",
    price: "Free",
    points: [
      "1 project",
      "Release scheduling",
      "Basic targeting",
      "API access",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    suffix: "/mo",
    points: [
      "Unlimited projects",
      "Advanced targeting",
      "Checklist analytics",
      "Integrations",
    ],
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const primaryCtaTo = isAuthenticated ? "/get-started" : "/register";
  const primaryCtaLabel = isAuthenticated ? "Open workspace" : "Get started";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <section className="mx-auto w-full max-w-[1080px] px-4 pt-20 text-center md:pt-24">
        <div className="mx-auto size-12 rounded-full bg-muted" aria-hidden />

        <p className="mt-4 text-[42px] leading-none font-semibold tracking-tight text-foreground">
          Baxso
        </p>

        <h1 className="mx-auto mt-8 max-w-[560px] text-[40px] leading-[1.12] font-semibold tracking-tight text-muted-foreground md:text-[54px]">
          A beautifully simple
          <br />
          release communication app.
        </h1>

        <Button asChild className="mt-8 h-12 rounded-full px-7 text-base font-semibold">
          <Link to={primaryCtaTo}>{primaryCtaLabel}</Link>
        </Button>

        <p className="mt-8 text-sm text-muted-foreground">
          No setup friction, just clear updates.
        </p>

        <div className="mx-auto mt-10 w-full max-w-[760px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
            </div>
            <div className="rounded-full border border-border bg-panel px-1.5 py-1 text-[11px]">
              <span className="rounded-full bg-card px-2 py-0.5 font-medium text-foreground">
                Inbox
              </span>
              <span className="px-2 text-muted-foreground">Archive</span>
            </div>
            <span className="size-6 rounded-full bg-muted" />
          </div>

          <div className="space-y-3 px-5 py-5 text-left">
            <p className="text-xs font-medium text-muted-foreground">Today</p>
            <PreviewItem
              title="Q1 release notes are now live"
              source="baxso.app"
            />
            <PreviewItem
              title="Improve onboarding completion"
              source="youtube.com"
            />
            <PreviewItem
              title="Launch checklist: mobile polish"
              source="docs.baxso.app"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 w-full max-w-[980px] px-4 md:mt-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Supercharged release operations.
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-center text-sm text-muted-foreground">
          Everything you need to plan, ship, and measure product updates.
        </p>

        <div className="mt-6 grid gap-2.5 md:grid-cols-2">
          {FEATURE_ITEMS.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <p className="text-sm font-semibold text-foreground">
                {item.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 w-full max-w-[980px] px-4 pb-16 md:mt-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Pricing
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Start free, upgrade when your team needs more control.
        </p>

        <div className="mx-auto mt-6 grid max-w-[760px] gap-3 md:grid-cols-2">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="text-sm font-semibold text-foreground">
                {plan.name}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                {plan.price}
                {plan.suffix ? (
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    {plan.suffix}
                  </span>
                ) : null}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {plan.points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
              <Button
                asChild
                variant={plan.name === "Pro" ? "default" : "outline"}
                size="sm"
                className="mt-4"
              >
                <Link to={primaryCtaTo}>
                  {plan.name === "Pro" ? "Choose Pro" : "Get started"}
                </Link>
              </Button>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Made for focused product teams.
        </p>
      </section>

    </main>
  );
}

function PreviewItem(props: { title: string; source: string }) {
  return (
    <div className="flex items-center gap-2 text-[15px]">
      <span className="size-2 rounded-full bg-primary" />
      <span className="font-medium text-foreground">{props.title}</span>
      <span className="text-muted-foreground">{props.source}</span>
    </div>
  );
}
