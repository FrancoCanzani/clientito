import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

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

const SCREENER_PREVIEW_ROWS: Array<{
  sender: string;
  when: string;
  subject: string;
  snippet: string;
}> = [
  {
    sender: "Nora from Vellum <nora@vellum.io>",
    when: "Today 09:14",
    subject: "Q2 rollout timeline",
    snippet: "Sharing the updated plan and milestones for next week.",
  },
  {
    sender: "Bruno at Seedbank <bruno@seedbank.dev>",
    when: "Yesterday 17:42",
    subject: "Invoice #4821",
    snippet: "Attaching the final invoice and payment details.",
  },
  {
    sender: "Mina <mina@studio.pm>",
    when: "Yesterday 11:06",
    subject: "Intro from Alex",
    snippet: "Alex suggested I reach out about the product brief.",
  },
  {
    sender: "Payroll Team <payroll@acmefinance.com>",
    when: "Tue 08:55",
    subject: "Action required: verify bank details",
    snippet: "Please confirm your payout account before Friday cutoff.",
  },
  {
    sender: "Samir from Northline <samir@northline.app>",
    when: "Mon 16:28",
    subject: "Following up on your integration question",
    snippet: "I recorded a short walkthrough for the webhook setup.",
  },
];

const ENCRYPTION_ROW_DEMO: Array<{
  sender: string;
  snippet: string;
}> = [
  {
    sender: "Payroll Team <payroll@acmefinance.com>",
    snippet: "Amount: $2,130 due Apr 28 · Confirm payout account details",
  },
  {
    sender: "Nora from Vellum <nora@vellum.io>",
    snippet: "Updated milestones and owners for next week's launch",
  },
  {
    sender: "Samir from Northline <samir@northline.app>",
    snippet: "Sharing a short walkthrough and expected callback payload",
  },
];
const ENCRYPTION_CHARS = "0123456789ABCDEF";
const ENCRYPTION_TRANSITION_STEPS = 12;
const ENCRYPTION_TRANSITION_TICK_MS = 45;
const ENCRYPTION_HOLD_ENCRYPTED_MS = 1800;
const ENCRYPTION_HOLD_DECRYPTED_MS = 2200;

type EncryptionPhase =
  | "hold-encrypted"
  | "to-decrypted"
  | "hold-decrypted"
  | "to-encrypted";

function revealRatioForPhase(phase: EncryptionPhase, step: number): number {
  if (phase === "hold-encrypted") return 0.04;
  if (phase === "hold-decrypted") return 1;
  if (phase === "to-decrypted") {
    return Math.min(1, (step + 1) / ENCRYPTION_TRANSITION_STEPS);
  }
  return Math.max(0.04, 1 - (step + 1) / ENCRYPTION_TRANSITION_STEPS);
}

function buildEncryptedFrame(
  text: string,
  revealRatio: number,
  seed: number,
): string {
  const threshold = Math.round(revealRatio * 100);

  return text
    .split("")
    .map((char, index) => {
      if (char === " ") return " ";
      if (
        char === "|" ||
        char === ":" ||
        char === "#" ||
        char === "," ||
        char === "$"
      ) {
        return char;
      }

      const revealSeed = (index * 29 + seed * 17) % 100;
      if (revealSeed < threshold) return char;

      const noiseSeed = (index * 31 + seed * 7) % ENCRYPTION_CHARS.length;
      return ENCRYPTION_CHARS[noiseSeed] ?? "0";
    })
    .join("");
}

function EncryptionPreviewRow() {
  const [phase, setPhase] = useState<EncryptionPhase>("hold-encrypted");
  const [phaseStep, setPhaseStep] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => {
        if (phase === "hold-encrypted") {
          setPhase("to-decrypted");
          setPhaseStep(0);
          return;
        }
        if (phase === "hold-decrypted") {
          setPhase("to-encrypted");
          setPhaseStep(0);
          return;
        }

        if (phaseStep >= ENCRYPTION_TRANSITION_STEPS - 1) {
          setPhase(
            phase === "to-decrypted" ? "hold-decrypted" : "hold-encrypted",
          );
          setPhaseStep(0);
          return;
        }
        setPhaseStep((current) => current + 1);
      },
      phase.startsWith("hold")
        ? phase === "hold-encrypted"
          ? ENCRYPTION_HOLD_ENCRYPTED_MS
          : ENCRYPTION_HOLD_DECRYPTED_MS
        : ENCRYPTION_TRANSITION_TICK_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [phase, phaseStep]);

  const revealRatio = revealRatioForPhase(phase, phaseStep);
  const seed =
    phaseStep +
    (phase === "hold-encrypted"
      ? 300
      : phase === "to-decrypted"
        ? 200
        : phase === "hold-decrypted"
          ? 100
          : 400);
  return (
    <div className="bg-sidebar p-1 rounded">
      {ENCRYPTION_ROW_DEMO.map((row, index) => {
        const rowSeed = seed + index * 53;
        const displaySender = buildEncryptedFrame(
          row.sender,
          revealRatio,
          rowSeed + 11,
        );

        const displayText = buildEncryptedFrame(
          row.snippet,
          revealRatio,
          rowSeed + 23,
        );

        return (
          <div
            key={row.sender}
            className="flex bg-background rounded h-11 w-full items-center gap-3 border-b border-border/30 px-4 text-left text-xs last:border-b-0"
          >
            <p className="max-w-[50%] shrink-0 truncate font-medium text-primary">
              {displaySender}
            </p>
            <p className="min-w-0 flex-1 truncate text-muted-foreground">
              {displayText}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const preferredMailboxId = getPreferredMailboxId(accounts);

  return (
    <div className="min-h-svh bg-background text-foreground antialiased">
      <header>
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
          <Link
            to="/"
            className="font-serif text-2xl font-medium tracking-tight"
          >
            Duomo
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
                Open Duomo
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
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground-title leading-[1.3] text-center">
            A Smaller, <span className="bg-yellow-200">Private</span>,
            Inbox{" "}
          </h1>
          <p className="text-foreground text-base sm:text-lg mt-5 mb-8 max-w-xl mx-auto text-center">
            Duomo screens what arrives, finishes what's done, and stays out of
            your way. Connects to Gmail in one click.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              size={"lg"}
              variant={"secondary"}
              className="text-lg h-10"
              asChild
            >
              <Link to="/login">Continue with Google</Link>
            </Button>
          </div>
        </section>

        <section className="pb-24">
          <div className="overflow-hidden rounded-md border border-border/80 bg-sidebar shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
            </div>
            <div className="flex min-h-105 items-center justify-center p-12">
              <p className="text-xs text-muted-foreground">Inbox screenshot</p>
            </div>
          </div>
        </section>

        <span className="w-full flex justify-center font-medium text-xl">
          Features
        </span>

        <section className="py-20 md:py-24">
          <div className="mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="text-lg">Where your mail lives</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            Your inbox, in your browser.
          </h2>
          <div className="mt-6 space-y-6 text-xs leading-relaxed text-muted-foreground md:text-base">
            <p className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
              Duomo doesn't keep a copy of your inbox on our servers. Your mail
              is fetched from Gmail and stored locally, in your browser. Our
              database has no{" "}
              <span className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                emails
              </span>{" "}
              table. Drafts and scheduled sends do pass through our servers —
              they have to, so they sync across devices and fire on time.
              They're encrypted at rest. AI helpers are optional. When you use
              one, that text is sent to the model for that single request.
            </p>
            <EncryptionPreviewRow />
            <div className="flex items-center justify-between text-sm">
              <p className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
                No ads. No trackers. No selling data. Ever.
              </p>
              <Link to="/privacy" className="underline underline-offset-4">
                Read the full privacy policy
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <div className="mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span className="text-lg">The Screener</span>
          </div>{" "}
          <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            Doors before drawers.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Review new senders before they enter your inbox. Approve people you
            trust, reject the rest.
          </p>
          <div className="mt-4 overflow-hidden rounded bg-sidebar p-1">
            <div className="overflow-hidden rounded bg-background shadow-xs">
              <div className="px-3 p-2 text-muted-foreground text-sm">
                New senders
              </div>
              <ul>
                {SCREENER_PREVIEW_ROWS.map((row) => (
                  <li
                    key={row.sender}
                    className="border-b border-border/30 first:border-t last:border-b-0 py-3 bg-sidebar/40 shadow-2xs"
                  >
                    <div className="flex px-3 justify-between">
                      <p className="truncate text-sm">{row.sender}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="destructive">
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-green-900"
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <div className="mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="text-lg">A Finished Inbox</span>
            <span className="h-px flex-1 bg-border" />
          </div>{" "}
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

        <section className="py-20 md:py-24">
          <div className="mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span className="text-lg">Keyboard First</span>
          </div>{" "}
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

        <section className="py-20 md:py-24">
          <div className="mb-6 flex items-center gap-3 text-muted-foreground">
            <span className="text-lg">Made Carefully</span>
            <span className="h-px flex-1 bg-border" />
          </div>{" "}
          <p className="font-serif text-2xl italic leading-relaxed tracking-tight text-foreground/90 md:text-3xl">
            Email used to feel like a place you visited and then left. Duomo is
            built to give that back — a calm room, a clear door, and a way out.
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
