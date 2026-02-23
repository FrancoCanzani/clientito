import { Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/api/auth_api";
import { PageLoader } from "@/components/page_loader";

export function LandingMarketing() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  const primaryCtaTo = isAuthenticated ? "/projects" : "/register";
  const primaryCtaLabel = isAuthenticated ? "Open workspace" : "Start free";

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#0f172a]">
      <header className="border-b border-[#e2e8f0] bg-[#fcfcfb]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#334155]">ReleaseLayer</div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-md border border-[#dbe3ed] px-3 py-1.5 text-xs font-medium text-[#334155]">
              Log in
            </Link>
            <Link to={primaryCtaTo} className="rounded-md bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white">
              {primaryCtaLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-7">
        <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <div className="inline-flex rounded-md border border-[#cad8ff] bg-[#eef4ff] px-2.5 py-1 text-[11px] font-semibold text-[#1d4ed8]">
            Product Hunt · #3 Product of the Day
          </div>
          <h1 className="mt-3 max-w-2xl text-[30px] font-semibold leading-[1.12] tracking-tight text-[#0f172a]">
            You ship features.
            <br />
            Your users feel progress.
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-[#475569]">
            You turn release chaos into a clear rhythm with scheduling, targeting, checklists, and integrations in one workflow.
          </p>
          <p className="mt-1 max-w-xl text-[13px] leading-6 text-[#475569]">
            You join 2,300+ teams and 18,000+ active users using ReleaseLayer every week.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Link to={primaryCtaTo} className="rounded-md bg-[#0369a1] px-3.5 py-1.5 text-xs font-semibold text-white">
              {primaryCtaLabel}
            </Link>
            <span className="rounded-md border border-[#e2e8f0] px-2.5 py-1 text-[11px] text-[#64748b]">Setup in under 10 minutes</span>
          </div>
          {isAuthenticated && user?.email && (
            <p className="mt-2 text-xs text-[#64748b]">Signed in as {user.email}</p>
          )}
        </section>

        <section className="grid gap-4 rounded-lg border border-[#e2e8f0] bg-white p-5 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Why this exists</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">A quick story for you.</h2>
            <p className="mt-3 text-[13px] leading-6 text-[#475569]">
              We kept launching work that looked great internally, but your users never saw the full story.
            </p>
            <p className="mt-2 text-[13px] leading-6 text-[#475569]">
              We built ReleaseLayer so your team can ship fast and still guide people through what changed and why it matters.
            </p>
          </div>
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">Live rollout sample</div>
            <div className="space-y-2 text-[12px] text-[#334155]">
              <div className="rounded-md border border-[#dbe3ed] bg-white px-2.5 py-2">Draft created → Target pro users</div>
              <div className="rounded-md border border-[#dbe3ed] bg-white px-2.5 py-2">Publish at 14:00 UTC → End at 21:00 UTC</div>
              <div className="rounded-md border border-[#dbe3ed] bg-white px-2.5 py-2">Checklist completion +32% in first day</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1e293b]">Trusted by teams and covered by product press.</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
            <LogoChip label="Linear Labs" />
            <LogoChip label="LaunchPilot" />
            <LogoChip label="Northstar AI" />
            <LogoChip label="Product Weekly" />
            <LogoChip label="SaaS Operator" />
            <LogoChip label="The Changelog" />
          </div>
        </section>

        <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1e293b]">Only four product surfaces you need right now.</h2>
          <div className="mt-3 grid gap-2.5 md:grid-cols-2">
            <FeatureCard title="Release scheduling" text="You set publish and unpublish windows so your messaging lands when your users are active." />
            <FeatureCard title="Checklist targeting" text="You route onboarding tasks to the right user segment based on real traits." />
            <FeatureCard title="Integrations" text="You connect events to Slack, GitHub, GitLab, and custom webhooks." />
            <FeatureCard title="SDK control" text="You configure display behavior and rollout style from one compact panel." />
          </div>
          <div className="mt-4">
            <Link to={primaryCtaTo} className="rounded-md bg-[#0f172a] px-3.5 py-1.5 text-xs font-semibold text-white">
              {primaryCtaLabel}
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1e293b]">Opinion leaders first.</h2>
          <div className="mt-3 grid gap-2.5 md:grid-cols-3">
            <QuoteCard quote="ReleaseLayer gives product teams a clean bridge from shipping to adoption." person="Elena Park" role="Product Growth Advisor" />
            <QuoteCard quote="The scheduling model is the right level of control without dashboard noise." person="Jon Reyes" role="SaaS Strategy Analyst" />
            <QuoteCard quote="This feels focused, practical, and sharp for startup product orgs." person="Mina Ortiz" role="DevRel Opinion Leader" />
          </div>
        </section>

        <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1e293b]">Then customer results.</h2>
          <div className="mt-3 grid gap-2.5 md:grid-cols-3">
            <QuoteCard quote="Your onboarding completion jumped after targeted release checklists." person="Noah Kim" role="Head of Product, LaunchPilot" />
            <QuoteCard quote="Your support queue dropped because users finally understood changes." person="Sasha Reed" role="CEO, Northstar AI" />
            <QuoteCard quote="You kept your ship speed and gained adoption clarity." person="Iris Moore" role="PM, Linear Labs" />
          </div>
        </section>

        <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1e293b]">Paid plans.</h2>
          <p className="mt-1 text-xs text-[#64748b]">Three plans so your team can grow without migration pain.</p>
          <div className="mt-3 grid gap-2.5 md:grid-cols-3">
            <PlanCard name="Starter" price="$29" sentenceOne="You launch scheduled releases and basic targeting." sentenceTwo="You run one product workspace." />
            <PlanCard name="Growth" price="$99" sentenceOne="You unlock advanced targeting and checklist analytics." sentenceTwo="You run five products and team roles." />
            <PlanCard name="Scale" price="$299" sentenceOne="You unlock custom events, higher limits, and priority support." sentenceTwo="You run multi-org programs." />
          </div>
          <div className="mt-4">
            <Link to={primaryCtaTo} className="rounded-md bg-[#0369a1] px-3.5 py-1.5 text-xs font-semibold text-white">
              Explore plans
            </Link>
          </div>
        </section>

        <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1e293b]">Hard questions answered.</h2>
          <FaqItem question="What if your users ignore release notes today." answer="You target by trait and timing so each person sees relevant updates only." />
          <FaqItem question="What if your team ships daily and context changes hourly." answer="You schedule windows and keep one narrative thread across rapid updates." />
          <FaqItem question="What if your app serves multiple orgs with different priorities." answer="You isolate release visibility by org conditions to avoid irrelevant noise." />
          <FaqItem question="What if leadership asks for proof next week." answer="You show checklist completion and interaction data tied to each release cycle." />
        </section>

        <section className="rounded-lg border border-[#e2e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#1e293b]">Refund policy.</h2>
          <p className="mt-2 text-[13px] leading-6 text-[#475569]">
            You can request a full refund within 30 days if ReleaseLayer does not improve your release communication workflow.
          </p>
          <p className="mt-1 text-[13px] leading-6 text-[#475569]">
            You contact support with your workspace email and your refund is processed within five business days.
          </p>
        </section>
      </main>
    </div>
  );
}

function LogoChip(props: { label: string }) {
  return (
    <div className="rounded-md border border-[#e2e8f0] bg-[#fbfdff] px-2.5 py-2 text-center text-[11px] font-semibold text-[#334155]">
      {props.label}
    </div>
  );
}

function FeatureCard(props: { title: string; text: string }) {
  return (
    <article className="rounded-md border border-[#e2e8f0] bg-[#fbfdff] p-3">
      <h3 className="text-xs font-semibold text-[#1e293b]">{props.title}</h3>
      <p className="mt-1 text-[12px] leading-5 text-[#475569]">{props.text}</p>
    </article>
  );
}

function QuoteCard(props: { quote: string; person: string; role: string }) {
  return (
    <article className="rounded-md border border-[#e2e8f0] bg-[#fbfdff] p-3">
      <p className="text-[12px] leading-5 text-[#1e293b]">“{props.quote}”</p>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-[#334155]">{props.person}</div>
      <div className="text-[11px] text-[#64748b]">{props.role}</div>
    </article>
  );
}

function PlanCard(props: { name: string; price: string; sentenceOne: string; sentenceTwo: string }) {
  return (
    <article className="rounded-md border border-[#e2e8f0] bg-[#fbfdff] p-3">
      <h3 className="text-sm font-semibold text-[#1e293b]">{props.name}</h3>
      <div className="mt-0.5 text-lg font-semibold text-[#0f172a]">
        {props.price}
        <span className="ml-1 text-[11px] font-medium text-[#64748b]">/month</span>
      </div>
      <p className="mt-1 text-[12px] leading-5 text-[#475569]">{props.sentenceOne}</p>
      <p className="mt-0.5 text-[12px] leading-5 text-[#475569]">{props.sentenceTwo}</p>
    </article>
  );
}

function FaqItem(props: { question: string; answer: string }) {
  return (
    <article className="mt-2 rounded-md border border-[#e2e8f0] bg-[#fbfdff] p-3">
      <h3 className="text-xs font-semibold text-[#1e293b]">{props.question}</h3>
      <p className="mt-1 text-[12px] leading-5 text-[#475569]">{props.answer}</p>
    </article>
  );
}
