import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/api";
import { Link } from "@tanstack/react-router";

const FEATURE_ITEMS = [
  {
    title: "Sync Gmail instantly",
    description: "Pull customer threads into one shared workspace.",
  },
  {
    title: "Classify with AI",
    description: "Auto-label urgent requests, quotes, and follow-ups.",
  },
  {
    title: "Capture notes fast",
    description: "Keep context on each customer account and shipment lane.",
  },
  {
    title: "Set reminders",
    description: "Never miss callbacks, ETA checks, or renewal dates.",
  },
  {
    title: "Send dispatch emails",
    description: "Compose outbound updates from the same customer record.",
  },
  {
    title: "Stay lightweight",
    description: "Clean UI, minimal setup, and no CRM bloat.",
  },
];

const PLANS = [
  {
    name: "Basic",
    price: "Free",
    points: [
      "40 customers",
      "Gmail sync",
      "Notes and reminders",
      "Email dispatch",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    suffix: "/mo",
    points: [
      "Unlimited customers",
      "AI classification",
      "Team access",
      "Priority support",
    ],
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const primaryCtaTo = isAuthenticated ? "/get-started" : "/login";
  const primaryCtaLabel = isAuthenticated ? "Open workspace" : "Get started";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <section className="mx-auto w-full max-w-[1080px] px-4 pt-20 text-center md:pt-24">
        <div className="mx-auto size-12 rounded bg-muted" aria-hidden />

        <p className="mt-4 text-[42px] leading-none font-semibold tracking-tight text-foreground">
          Clientito
        </p>

        <h1 className="mx-auto mt-8 max-w-[560px] text-[40px] leading-[1.12] font-semibold tracking-tight text-muted-foreground md:text-[54px]">
          A beautifully simple
          <br />
          customer CRM app.
        </h1>

        <Button asChild className="mt-8 h-12 rounded px-7 text-base font-semibold">
          <Link to={primaryCtaTo}>{primaryCtaLabel}</Link>
        </Button>

        <p className="mt-8 text-sm text-muted-foreground">
          No setup friction, just clear customer operations.
        </p>

        <div className="mx-auto mt-10 w-full max-w-[760px] overflow-hidden rounded border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded bg-muted" />
              <span className="size-2.5 rounded bg-muted" />
              <span className="size-2.5 rounded bg-muted" />
            </div>
            <div className="rounded border border-border bg-panel px-1.5 py-1 text-[11px]">
              <span className="rounded bg-card px-2 py-0.5 font-medium text-foreground">
                Inbox
              </span>
              <span className="px-2 text-muted-foreground">Archive</span>
            </div>
            <span className="size-6 rounded bg-muted" />
          </div>

          <div className="space-y-3 px-5 py-5 text-left">
            <p className="text-xs font-medium text-muted-foreground">Today</p>
            <PreviewItem
              title="Need rate quote for route ATL -> MIA"
              source="gmail.com"
            />
            <PreviewItem
              title="Pickup delayed 45 minutes, please confirm"
              source="gmail.com"
            />
            <PreviewItem
              title="Reminder: call Northway Logistics by 4pm"
              source="clientito.app"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 w-full max-w-[980px] px-4 md:mt-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Supercharged customer operations.
        </h2>
        <p className="mx-auto mt-2 max-w-[520px] text-center text-sm text-muted-foreground">
          Everything you need to organize communication for transport customers.
        </p>

        <div className="mt-6 grid gap-2.5 md:grid-cols-2">
          {FEATURE_ITEMS.map((item) => (
            <article
              key={item.title}
              className="rounded border border-border bg-card px-4 py-3"
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
              className="rounded border border-border bg-card p-4"
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
          Made for focused transport teams.
        </p>
      </section>

    </main>
  );
}

function PreviewItem(props: { title: string; source: string }) {
  return (
    <div className="flex items-center gap-2 text-[15px]">
      <span className="size-2 rounded bg-primary" />
      <span className="font-medium text-foreground">{props.title}</span>
      <span className="text-muted-foreground">{props.source}</span>
    </div>
  );
}
