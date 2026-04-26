import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { Link } from "@tanstack/react-router";

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: "⌘K", label: "Open command palette" },
  { keys: "⌘C", label: "Compose new message" },
  { keys: "⌘1", label: "Inbox" },
  { keys: "⌘2", label: "Starred" },
  { keys: "⌘3", label: "Done" },
  { keys: "J / K", label: "Move between threads" },
  { keys: "E", label: "Mark as done" },
  { keys: "S", label: "Snooze" },
  { keys: "/", label: "Search" },
  { keys: "?", label: "Show all shortcuts" },
];

function SectionLabel({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      <span className="font-mono">{index}</span>
      <span className="h-px flex-1 bg-border" />
      <span>{title}</span>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const preferredMailboxId = getPreferredMailboxId(accounts);

  return (
    <div className="min-h-svh bg-background text-foreground antialiased">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-serif text-lg italic tracking-tight">
            duomo
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/docs" className="hover:text-foreground">
              Docs
            </Link>
            {isAuthenticated && preferredMailboxId ? (
              <Link
                to="/$mailboxId/inbox"
                params={{ mailboxId: String(preferredMailboxId) } as never}
                className="text-foreground hover:underline underline-offset-4"
              >
                Open Duomo →
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-foreground hover:underline underline-offset-4"
              >
                Log in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5">
        <section className="pt-24 pb-20 md:pt-32 md:pb-28">
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">
            <span className="italic">A smaller</span> inbox.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Duomo screens what arrives, finishes what's done, and stays out of
            your way. Connects to Gmail in one click.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              to="/login"
              className="inline-flex h-10 items-center rounded-md border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Continue with Google →
            </Link>
            <Link
              to="/docs"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Read the docs
            </Link>
          </div>
        </section>

        <section className="pb-24">
          <div className="overflow-hidden rounded-md border border-border/80 bg-sidebar shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
            </div>
            <div className="flex min-h-[420px] items-center justify-center p-12">
              <p className="text-xs text-muted-foreground">
                Inbox screenshot
              </p>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <SectionLabel index="01" title="The Screener" />
          <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            Doors before drawers.
          </h2>
          <div className="mt-6 max-w-xl space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            <p>
              Most clients let everything land in your inbox and ask you to
              file it after. Duomo holds new senders at the door.
            </p>
            <p>
              Approve once, and their mail comes straight through. Reject once,
              and you don't see them again. Familiar senders never wait —
              the screener only meets strangers.
            </p>
          </div>
        </section>

        <section className="border-t border-border/60 py-20 md:py-24">
          <SectionLabel index="02" title="A finished inbox" />
          <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            Done is a place.
          </h2>
          <dl className="mt-8 grid gap-6 md:grid-cols-3">
            <div>
              <dt className="mb-1.5 text-sm font-medium">Done</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                Archived in one keystroke. Out of sight, easy to recover.
              </dd>
            </div>
            <div>
              <dt className="mb-1.5 text-sm font-medium">Snoozed</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                Comes back when you said it should — not a minute earlier.
              </dd>
            </div>
            <div>
              <dt className="mb-1.5 text-sm font-medium">Splits</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                Separate streams of mail by rule, side by side, on one page.
              </dd>
            </div>
          </dl>
        </section>

        <section className="border-t border-border/60 py-20 md:py-24">
          <SectionLabel index="03" title="Keyboard-first" />
          <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            Move at your speed.
          </h2>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Every primary action has a shortcut. The mouse is optional.
          </p>
          <ul className="mt-8 grid gap-x-8 gap-y-2 font-mono text-xs sm:grid-cols-2">
            {SHORTCUTS.map((shortcut) => (
              <li
                key={shortcut.keys}
                className="flex items-center justify-between border-b border-border/40 py-2"
              >
                <span className="text-muted-foreground">{shortcut.label}</span>
                <kbd className="rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
                  {shortcut.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border/60 py-20 md:py-24">
          <SectionLabel index="04" title="Where your mail lives" />
          <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            Your inbox, in your browser.
          </h2>
          <div className="mt-6 max-w-xl space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            <p>
              Duomo doesn't keep a copy of your inbox on our servers. Your mail
              is fetched from Gmail and stored locally, in your browser. Our
              database has no <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">emails</code> table.
            </p>
            <p>
              Drafts and scheduled sends do pass through our servers — they
              have to, so they sync across devices and fire on time. They're
              encrypted at rest.
            </p>
            <p>
              AI helpers are optional. When you use one, that text is sent to
              OpenAI for that single request and not retained for training. If
              you don't use them, no message content leaves Cloudflare.
            </p>
            <p>No ads. No trackers. No selling data. Ever.</p>
            <p className="pt-2">
              <Link
                to="/privacy"
                className="text-foreground underline underline-offset-4"
              >
                Read the full privacy policy →
              </Link>
            </p>
          </div>
        </section>

        <section className="border-t border-border/60 py-20 md:py-24">
          <SectionLabel index="05" title="Made carefully" />
          <p className="font-serif text-2xl italic leading-relaxed tracking-tight text-foreground/90 md:text-3xl">
            Email used to feel like a place you visited and then left. Duomo
            is built to give that back — a calm room, a clear door, and a way
            out.
          </p>
        </section>

        <section className="border-t border-border/60 py-16">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="font-serif text-2xl tracking-tight">
                Try it on your inbox.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Free while in beta. Connect Gmail in one click.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex h-10 items-center rounded-md border border-foreground bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Continue with Google →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-base italic text-foreground">
              duomo
            </span>
            <span>· © {new Date().getFullYear()}</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/docs" className="hover:text-foreground">
              Docs
            </Link>
            <a
              href="mailto:hello@duomo.email"
              className="hover:text-foreground"
            >
              hello@duomo.email
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
