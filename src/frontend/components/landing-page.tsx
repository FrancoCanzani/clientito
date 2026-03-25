import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";

const FEATURE_PANELS = [
  {
    title: "Review once",
    description:
      "See the inbox, the notes, and the next step together instead of rebuilding context thread by thread.",
    label: "Inbox + notes",
  },
  {
    title: "Connect the thread",
    description:
      "Customer context stays attached to the work, so handoffs feel lighter and follow-up stops slipping.",
    label: "Shared context",
  },
  {
    title: "Keep promises visible",
    description:
      "Tasks come out of real conversations, which makes the day easier to close without loose ends.",
    label: "Task flow",
  },
];

const OPERATING_POINTS = [
  {
    title: "Work the inbox once",
    description:
      "Reply-needed threads, notes, and next actions stay together instead of being rebuilt from memory.",
  },
  {
    title: "Keep context in view",
    description:
      "Customer details live beside the conversation, so handoffs and follow-ups take less rereading.",
  },
  {
    title: "Turn follow-up into a system",
    description:
      "Tasks come out of real customer work, which means fewer dropped promises and fewer late callbacks.",
  },
];

const PREVIEW_NOTES = [
  "Northway prefers WhatsApp for pickup changes.",
  "Atlas wants quote revisions kept in the same thread.",
];

const PREVIEW_TASKS = [
  "Call Northway before 4pm",
  "Send revised ATL to MIA quote",
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const primaryCtaTo = isAuthenticated ? "/home" : "/login";
  const primaryCtaLabel = isAuthenticated ? "Open app" : "Log in";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground antialiased">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.04),transparent_72%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 sm:px-7 lg:px-8">
        <header className="flex items-center justify-between py-6 sm:py-7">
          <Link
            to="/"
            className="text-[0.9rem] font-medium tracking-[-0.03em] text-foreground"
          >
            Petit
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/docs"
              className="inline-flex h-9 items-center text-[0.82rem] font-medium tracking-[-0.02em] text-foreground/58 transition-colors duration-150 hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              to={primaryCtaTo}
              className="inline-flex h-9 items-center rounded-full bg-foreground px-3.5 text-[0.82rem] font-medium tracking-[-0.02em] text-background transition-[transform,background-color,color] duration-150 ease-out hover:bg-foreground/90 active:scale-[0.98]"
            >
              {primaryCtaLabel}
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col py-10 sm:py-14">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
            <p className="text-[0.66rem] font-medium tracking-[0.04em] text-foreground/42">
              Customer follow-up, held together
            </p>

            <h1 className="mt-5 max-w-3xl font-serif text-[2.55rem] leading-[0.96] font-normal tracking-[-0.05em] text-balance text-foreground sm:text-[4rem] lg:text-[4.85rem]">
              A quieter home for customer follow-up.
            </h1>

            <p className="mt-5 max-w-xl text-[0.94rem] leading-7 text-foreground/58 sm:text-[0.98rem]">
              Petit keeps email, notes, and tasks in one quiet workspace so
              your team spends less time triaging, less time rereading threads,
              and more time finishing the actual work.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <Link
                to={primaryCtaTo}
                className="inline-flex h-9 items-center rounded-full bg-foreground px-3.5 text-[0.82rem] font-medium tracking-[-0.02em] text-background transition-[transform,background-color,color] duration-150 ease-out hover:bg-foreground/90 active:scale-[0.98]"
              >
                {primaryCtaLabel}
              </Link>
              <Link
                to="/docs"
                className="inline-flex h-9 items-center text-[0.82rem] font-medium tracking-[-0.02em] text-foreground/58 transition-colors duration-150 hover:text-foreground"
              >
                Read docs
              </Link>
            </div>

            <div className="mt-14 w-full max-w-[62rem] rounded-[2rem] bg-foreground/[0.035] px-5 py-5 text-left sm:px-7 sm:py-7">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[0.82rem] font-medium tracking-[-0.02em] text-foreground/84">
                    Morning review
                  </span>
                  <span className="text-[0.68rem] font-medium tracking-[0.04em] text-foreground/34">
                    2 replies due
                  </span>
                </div>
                <span className="hidden text-[0.72rem] tracking-[-0.02em] text-foreground/38 sm:block">
                  Clear the day in one pass
                </span>
              </div>

              <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_0.85fr] lg:gap-10">
                <div className="rounded-[1.5rem] bg-background/80 px-5 py-5 sm:px-6 sm:py-6">
                  <h2 className="max-w-xl font-serif text-[1.6rem] leading-[1.04] font-normal tracking-[-0.04em] text-foreground sm:text-[2.25rem]">
                    What needs your attention today?
                  </h2>
                  <p className="mt-4 max-w-xl text-[0.92rem] leading-7 text-foreground/56">
                    Reply to Atlas about the rate revision, confirm the delayed
                    pickup with Northway, and turn the renewal thread into a
                    task before noon.
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-2">
                    <PreviewChip label="Email" />
                    <PreviewChip label="Notes" />
                    <PreviewChip label="Tasks" />
                  </div>

                  <p className="mt-5 text-[0.78rem] tracking-[-0.02em] text-foreground/38">
                    Context stays attached while you work.
                  </p>
                </div>

                <div className="grid content-start gap-6">
                  <aside>
                    <p className="text-[0.66rem] font-medium tracking-[0.04em] text-foreground/36">
                      Notes
                    </p>
                    <div className="mt-3 space-y-3">
                      {PREVIEW_NOTES.map((note) => (
                        <InlineNote key={note} text={note} />
                      ))}
                    </div>
                  </aside>

                  <aside>
                    <p className="text-[0.66rem] font-medium tracking-[0.04em] text-foreground/36">
                      Follow-up
                    </p>
                    <div className="mt-3 space-y-3">
                      {PREVIEW_TASKS.map((task) => (
                        <TaskLine key={task} text={task} />
                      ))}
                    </div>
                  </aside>
                </div>
              </div>

              <div className="mt-11 grid gap-8 md:grid-cols-3 md:gap-10">
                {FEATURE_PANELS.map((item) => (
                  <FeaturePanel
                    key={item.title}
                    title={item.title}
                    description={item.description}
                    label={item.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 sm:py-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.1fr] lg:gap-16">
            <div>
              <p className="text-[0.68rem] font-medium tracking-[0.04em] text-foreground/36">
                Where the hours go back
              </p>
              <h2 className="mt-4 max-w-md font-serif text-[1.9rem] leading-[1.04] font-normal tracking-[-0.045em] text-foreground sm:text-[2.45rem]">
                Less churn. Fewer dropped follow-ups. More finished days.
              </h2>
            </div>

            <div className="space-y-7">
              {OPERATING_POINTS.map((item) => (
                <article key={item.title} className="grid gap-2 sm:grid-cols-[180px_1fr]">
                  <p className="text-[0.9rem] font-medium tracking-[-0.02em] text-foreground">
                    {item.title}
                  </p>
                  <p className="max-w-xl text-[0.92rem] leading-7 text-foreground/56">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="rounded-[1.75rem] bg-foreground/[0.035] px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-lg">
                <p className="text-[0.68rem] font-medium tracking-[0.04em] text-foreground/36">
                  Calm by default
                </p>
                <p className="mt-3 font-serif text-[1.65rem] leading-[1.06] font-normal tracking-[-0.045em] text-foreground sm:text-[2.15rem]">
                  Built for teams that want the day to feel held together.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to={primaryCtaTo}
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-3.5 text-[0.82rem] font-medium tracking-[-0.02em] text-background transition-[transform,background-color,color] duration-150 ease-out hover:bg-foreground/90 active:scale-[0.98]"
                >
                  {primaryCtaLabel}
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex h-9 items-center text-[0.82rem] font-medium tracking-[-0.02em] text-foreground/58 transition-colors duration-150 hover:text-foreground"
                >
                  Explore docs
                </Link>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-auto flex flex-col gap-4 py-6 text-[0.86rem] text-foreground/42 sm:flex-row sm:items-center sm:justify-between">
          <p>A calmer system for customer email, notes, and follow-up.</p>
          <div className="flex items-center gap-4">
            <Link
              to="/docs"
              className="transition-colors duration-150 hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              to={primaryCtaTo}
              className="transition-colors duration-150 hover:text-foreground"
            >
              {primaryCtaLabel}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function FeaturePanel(props: {
  title: string;
  description: string;
  label: string;
}) {
  return (
    <article>
      <h3 className="font-serif text-[1.35rem] leading-[1.08] font-normal tracking-[-0.04em] text-foreground">
        {props.title}
      </h3>
      <p className="mt-3 max-w-sm text-[0.9rem] leading-7 text-foreground/56">
        {props.description}
      </p>
      <p className="mt-5 text-[0.68rem] font-medium tracking-[0.04em] text-foreground/34">
        {props.label}
      </p>
    </article>
  );
}

function PreviewChip(props: { label: string }) {
  return (
    <span className="inline-flex h-8 items-center rounded-full bg-foreground/[0.045] px-3 text-[0.78rem] font-medium tracking-[-0.02em] text-foreground/58">
      {props.label}
    </span>
  );
}

function InlineNote(props: { text: string }) {
  return (
    <p className="text-[0.9rem] leading-6 text-foreground/58">{props.text}</p>
  );
}

function TaskLine(props: { text: string }) {
  return (
    <p className="text-[0.9rem] leading-6 text-foreground/58">{props.text}</p>
  );
}
