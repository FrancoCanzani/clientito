import { getPreferredMailboxId } from "@/features/email/mail/utils/mailbox";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { diffWords } from "diff";
import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";

type Shortcut = {
  keys: string;
  label: string;
  keyIds: string[];
};

type KeyboardKey = {
  id: string;
  label: string;
  width?: number;
};
const KEYBOARD_UNIT_REM = 1.8;

const SHORTCUTS: Shortcut[] = [
  { keys: "⌘K", label: "Open command palette", keyIds: ["CMD", "K"] },
  { keys: "⌘C", label: "Compose new message", keyIds: ["CMD", "C"] },
  { keys: "⌘1", label: "Inbox", keyIds: ["CMD", "1"] },
  { keys: "⌘2", label: "Starred", keyIds: ["CMD", "2"] },
  { keys: "⌘3", label: "Done", keyIds: ["CMD", "3"] },
  { keys: "J / K", label: "Move between threads", keyIds: ["J", "K"] },
  { keys: "E", label: "Mark as done", keyIds: ["E"] },
  { keys: "S", label: "Snooze", keyIds: ["S"] },
  { keys: "/", label: "Search", keyIds: ["SLASH"] },
  { keys: "?", label: "Show all shortcuts", keyIds: ["SHIFT", "SLASH"] },
];
const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: "Do you store my emails on your servers?",
    answer:
      "No. Mail is fetched from Gmail and stored locally in your browser.",
  },
  {
    question: "When does AI see my text?",
    answer:
      "Only when you trigger an AI action. It is request-by-request, not always on.",
  },
  {
    question: "Can I use Duomo without shortcuts?",
    answer:
      "Yes. Every workflow is accessible with mouse and touch, shortcuts are optional.",
  },
  {
    question: "What if I reject a sender in Screener?",
    answer:
      "New messages from that sender are moved out of inbox and blocked according to your mailbox rules.",
  },
];

const KEYBOARD_LAYOUT: KeyboardKey[][] = [
  [
    { id: "ESC", label: "Esc", width: 1.4 },
    { id: "F1", label: "F1" },
    { id: "F2", label: "F2" },
    { id: "F3", label: "F3" },
    { id: "F4", label: "F4" },
    { id: "F5", label: "F5" },
    { id: "F6", label: "F6" },
    { id: "F7", label: "F7" },
    { id: "F8", label: "F8" },
    { id: "F9", label: "F9" },
    { id: "F10", label: "F10" },
    { id: "F11", label: "F11" },
    { id: "F12", label: "F12" },
    { id: "LOCK", label: "🔒", width: 1.4 },
  ],
  [
    { id: "BACKTICK", label: "~\n`" },
    { id: "1", label: "!\n1" },
    { id: "2", label: "@\n2" },
    { id: "3", label: "#\n3" },
    { id: "4", label: "$\n4" },
    { id: "5", label: "%\n5" },
    { id: "6", label: "^\n6" },
    { id: "7", label: "&\n7" },
    { id: "8", label: "*\n8" },
    { id: "9", label: "(\n9" },
    { id: "0", label: ")\n0" },
    { id: "MINUS", label: "_\n-" },
    { id: "EQUAL", label: "+\n=" },
    { id: "BACKSPACE", label: "delete", width: 2.2 },
  ],
  [
    { id: "TAB", label: "Tab", width: 1.6 },
    { id: "Q", label: "Q" },
    { id: "W", label: "W" },
    { id: "E", label: "E" },
    { id: "R", label: "R" },
    { id: "T", label: "T" },
    { id: "Y", label: "Y" },
    { id: "U", label: "U" },
    { id: "I", label: "I" },
    { id: "O", label: "O" },
    { id: "P", label: "P" },
    { id: "LBRACKET", label: "[" },
    { id: "RBRACKET", label: "]" },
    { id: "BACKSLASH", label: "\\", width: 1.6 },
  ],
  [
    { id: "CAPS", label: "Caps", width: 1.9 },
    { id: "A", label: "A" },
    { id: "S", label: "S" },
    { id: "D", label: "D" },
    { id: "F", label: "F" },
    { id: "G", label: "G" },
    { id: "H", label: "H" },
    { id: "J", label: "J" },
    { id: "K", label: "K" },
    { id: "L", label: "L" },
    { id: "SEMICOLON", label: ";" },
    { id: "QUOTE", label: "'" },
    { id: "ENTER", label: "Enter", width: 2.3 },
  ],
  [
    { id: "SHIFT", label: "Shift", width: 2.4 },
    { id: "Z", label: "Z" },
    { id: "X", label: "X" },
    { id: "C", label: "C" },
    { id: "V", label: "V" },
    { id: "B", label: "B" },
    { id: "N", label: "N" },
    { id: "M", label: "M" },
    { id: "COMMA", label: "," },
    { id: "DOT", label: "." },
    { id: "SLASH", label: "/" },
    { id: "SHIFT_R", label: "Shift", width: 2.8 },
  ],
  [
    { id: "GLOBE", label: "🌐", width: 1.3 },
    { id: "CTRL", label: "Ctrl", width: 1.6 },
    { id: "ALT", label: "Alt", width: 1.4 },
    { id: "CMD", label: "⌘", width: 1.8 },
    { id: "SPACE", label: "", width: 5.8 },
    { id: "CMD_R", label: "⌘", width: 1.8 },
    { id: "ALT_R", label: "Alt", width: 1.4 },
    { id: "ARROWS", label: "", width: 3.4 },
  ],
];

const AI_GRAMMAR_ORIGINAL =
  "hi team, i reviewed the deck and its looking good. can you send me the latest numbers by friday?";
const AI_GRAMMAR_CORRECTED =
  "Hi team, I reviewed the deck, and it's looking good. Can you send me the latest numbers by Friday?";
const AI_TONE_OPTIONS: Array<{ label: string; selected?: boolean }> = [
  { label: "Improve writing" },
  { label: "Make more formal", selected: true },
  { label: "Make more casual" },
  { label: "Make more concise" },
];
const AI_AUTO_LABELS: Array<{ sender: string; label: string; color: string }> =
  [
    {
      sender: "billing@acmefinance.com",
      label: "Invoice",
      color: "#ffe6c7",
    },
    {
      sender: "updates@orbitstatus.com",
      label: "Notification",
      color: "#c9daf8",
    },
    {
      sender: "digest@builderweekly.com",
      label: "Newsletter",
      color: "#b9e4d0",
    },
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

function AiGrammarDiffPreview() {
  const parts = useMemo(
    () => diffWords(AI_GRAMMAR_ORIGINAL, AI_GRAMMAR_CORRECTED),
    [],
  );

  return (
    <AiFeatureCard title="Grammar diff">
      <div className="flex min-h-0 flex-1 flex-col rounded border border-border/30 bg-sidebar/30 p-2">
        <div className="pb-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
          {parts.map((part, index) => {
            if (part.added) {
              return (
                <span
                  key={index}
                  className="rounded-sm bg-green-500/15 text-green-700 dark:text-green-400"
                >
                  {part.value}
                </span>
              );
            }
            if (part.removed) {
              return (
                <span
                  key={index}
                  className="rounded-sm bg-red-500/15 text-red-700 line-through dark:text-red-400"
                >
                  {part.value}
                </span>
              );
            }
            return <span key={index}>{part.value}</span>;
          })}
        </div>
        <div className="flex items-center justify-end gap-1 border-t border-border/30 pt-2">
          <Button variant="destructive" size="xs">
            Discard
          </Button>
          <Button variant="secondary" size="xs">
            Accept
          </Button>
        </div>
      </div>
    </AiFeatureCard>
  );
}

function AiFeatureCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded bg-sidebar p-1">
      <div className="flex h-full min-h-0 flex-col rounded bg-background p-3">
        <p className="mb-2 text-xs text-muted-foreground">{title}</p>
        {children}
      </div>
    </article>
  );
}

function AiPastelLabel({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 20%, transparent)`,
      }}
      className="rounded px-1.5 py-0.5 text-[11px] text-foreground/85"
    >
      {label}
    </span>
  );
}

function AiAutoLabelPreview() {
  return (
    <AiFeatureCard title="Auto labeling">
      <div className="space-y-1.5 rounded border border-border/30 bg-sidebar/30 p-2">
        {AI_AUTO_LABELS.map((item) => (
          <div
            key={item.sender}
            className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1.5 text-xs"
          >
            <span className="truncate">{item.sender}</span>
            <AiPastelLabel label={item.label} color={item.color} />
          </div>
        ))}
      </div>
    </AiFeatureCard>
  );
}

function AiToneComposerPreview() {
  return (
    <AiFeatureCard title="Tone change">
      <div className="rounded border border-border/30 bg-sidebar/30 p-2">
        <div className="rounded border border-border/30 bg-background px-2 py-2 text-xs leading-relaxed text-foreground/90">
          Hi team,{" "}
          <span className="bg-blue-600 text-secondary px-1">
            i wanted to follow up
          </span>{" "}
          on the rollout updates.
        </div>

        <div className="mt-1.5 inline-flex items-center gap-1 rounded border border-border/40 bg-background px-2 py-1 text-[11px] text-muted-foreground">
          Make more formal
          <CaretDownIcon className="size-3" />
        </div>

        <div className="mt-1 rounded border border-border/40 bg-background p-0.5">
          {AI_TONE_OPTIONS.map((option) => (
            <div
              key={option.label}
              className="flex items-center gap-2 rounded px-2 py-1 text-[11px] text-muted-foreground"
            >
              <span
                className={option.selected ? "font-medium text-foreground" : ""}
              >
                {option.label}
              </span>
              {option.selected && (
                <CheckIcon className="ml-auto size-3 text-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>
    </AiFeatureCard>
  );
}

function AiSummaryPreview() {
  return (
    <AiFeatureCard title="Summaries">
      <div className="rounded border border-border/30 bg-sidebar/30 p-2">
        <div className="rounded border border-border/30 bg-background px-2 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Email</p>
          <p className="mt-1 line-clamp-2">
            Quarterly planning notes: launch moved to Thursday, budget still
            pending sign-off, and legal review is blocking external comms.
          </p>
        </div>
        <div className="mt-2 rounded border border-border/30 bg-background px-2 py-2 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">AI summary</p>
          <ul className="mt-1 space-y-0.5">
            <li>- Launch moved to Thursday</li>
            <li>- Budget update needed before sign-off</li>
            <li>- Legal review is the current blocker</li>
          </ul>
        </div>
      </div>
    </AiFeatureCard>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const preferredMailboxId = getPreferredMailboxId(accounts);
  const [hoveredShortcut, setHoveredShortcut] = useState<string | null>(null);
  const highlightedKeyIds = useMemo(() => {
    if (!hoveredShortcut) return new Set<string>();
    const shortcut = SHORTCUTS.find((entry) => entry.keys === hoveredShortcut);
    return new Set(shortcut?.keyIds ?? []);
  }, [hoveredShortcut]);

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
                to="/$mailboxId/focus"
                params={{ mailboxId: preferredMailboxId }}
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
            <span className="text-lg">AI Helpers</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            Built into the flow.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            The same tools from composer: auto labeling, review diffs, tone
            controls, and quick summaries.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <AiAutoLabelPreview />
            <AiGrammarDiffPreview />
            <AiToneComposerPreview />
            <AiSummaryPreview />
          </div>
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
          <div className="mt-5 overflow-hidden rounded bg-sidebar p-1">
            <div className="rounded bg-background p-3 md:p-4">
              <div className="space-y-3">
                <div className="rounded border border-border/30 bg-sidebar/30 p-2">
                  <div className="w-full">
                    {KEYBOARD_LAYOUT.map((row, rowIndex) => (
                      <div key={rowIndex} className="mb-1.5 flex gap-1 last:mb-0">
                        {row.map((key) => {
                          if (key.id === "ARROWS") {
                            const arrowIds = ["LEFT", "DOWN", "UP", "RIGHT"];
                            const hasActiveArrow = arrowIds.some((id) =>
                              highlightedKeyIds.has(id),
                            );
                            const getArrowClass = (id: string) =>
                              `flex items-center justify-center rounded border text-[9px] font-medium transition-colors ${
                                highlightedKeyIds.has(id)
                                  ? "border-primary/40 bg-primary/10 text-foreground"
                                  : "border-border/40 bg-background text-muted-foreground"
                              }`;

                            return (
                              <div
                                key={key.id}
                                style={{
                                  width: `${(key.width ?? 1) * KEYBOARD_UNIT_REM}rem`,
                                }}
                                className={`grid h-8 grid-cols-3 grid-rows-2 gap-0.5 rounded border p-0.5 ${
                                  hasActiveArrow
                                    ? "border-primary/30 bg-primary/5"
                                    : "border-border/40 bg-muted/20"
                                }`}
                              >
                                <span />
                                <span className={getArrowClass("UP")}>↑</span>
                                <span />
                                <span className={getArrowClass("LEFT")}>←</span>
                                <span className={getArrowClass("DOWN")}>↓</span>
                                <span className={getArrowClass("RIGHT")}>→</span>
                              </div>
                            );
                          }

                          const isActive = highlightedKeyIds.has(key.id);
                          return (
                            <kbd
                              key={key.id}
                              style={{
                                width: `${(key.width ?? 1) * KEYBOARD_UNIT_REM}rem`,
                              }}
                              className={`inline-flex h-8 items-center justify-center rounded border px-1.5 text-[10px] leading-tight whitespace-pre-line font-medium transition-colors ${
                                isActive
                                  ? "border-primary/40 bg-primary/10 text-foreground"
                                  : "border-border/40 bg-background text-muted-foreground"
                              }`}
                            >
                              {key.label}
                            </kbd>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <p className="my-4 text-[11px] text-center text-muted-foreground font-medium">
                  Hover a command to preview the keys.
                </p>

                <div className="rounded border border-border/30 bg-sidebar/30 p-2">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {SHORTCUTS.map((shortcut) => (
                      <div
                        key={shortcut.keys}
                        className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs ${
                          hoveredShortcut === shortcut.keys
                            ? "border-primary/30 bg-primary/10"
                            : "border-border/30 bg-background"
                        }`}
                        onMouseEnter={() => setHoveredShortcut(shortcut.keys)}
                        onMouseLeave={() => setHoveredShortcut(null)}
                      >
                        <span className="truncate text-muted-foreground">
                          {shortcut.label}
                        </span>
                        <kbd className="rounded border border-border/50 bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
                          {shortcut.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <span className="w-full flex justify-center font-medium text-xl">
          FAQ
        </span>

        <section className="py-20 md:py-24">
          <Accordion type="single" collapsible className="border-border/30">
            {FAQ_ITEMS.map((item, index) => (
              <AccordionItem
                key={item.question}
                value={`faq-${index}`}
                className="bg-sidebar/30"
              >
                <AccordionTrigger className="px-3 py-2 text-sm">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 pt-0 text-sm text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
