import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Button } from "./ui/button";

const FOOTER_LINKS = ["Roadmap", "Contact", "Legal"];

const FEATURES = [
  "You choose your sources",
  "Chronological feed",
  "Personal email digest",
  "Search and filter",
];

const easeOut = [0.23, 1, 0.32, 1] as const;

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const preferredMailboxId = getPreferredMailboxId(accounts);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-8 sm:px-7 lg:px-8">
        <header className="flex items-center justify-between pt-6">
          <div className="flex items-center gap-2">
            <span className="inline-block size-1.5 rounded-full bg-neutral-900" />
            <span className="text-sm font-medium tracking-tight">Petit</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/docs"
              className="text-sm text-neutral-500 transition-colors duration-150 hover:text-neutral-900"
            >
              Docs
            </Link>
            <Button asChild variant="default" size="default" className="h-8 px-3">
              {isAuthenticated ? (
                <Link
                  to={preferredMailboxId ? "/$mailboxId/inbox" : "/get-started"}
                  params={
                    preferredMailboxId
                      ? { mailboxId: String(preferredMailboxId) }
                      : undefined
                  }
                >
                  Go to inbox
                </Link>
              ) : (
                <Link to="/login">Get started</Link>
              )}
            </Button>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 sm:py-20">
          <motion.p
            className="text-center text-xs tracking-wide text-neutral-500"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
          >
            Available on Web and MacOS. iOS and Android soon.
          </motion.p>

          <motion.h1
            className="mx-auto mt-4 max-w-3xl text-center font-serif text-[2.1rem] leading-[1.02] font-normal tracking-[-0.03em] text-balance sm:text-[3rem] lg:text-[3.6rem]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: easeOut }}
          >
            Your distraction-free reader for what matters.
          </motion.h1>

          <motion.p
            className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-neutral-600 sm:text-base"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: easeOut }}
          >
            Pick your favorite sources, stay chronological, and get a digest on
            your schedule. No ads, no tracking, no clutter.
          </motion.p>

          <motion.div
            className="mt-7 flex items-center justify-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: easeOut }}
          >
            <Button asChild size="default" className="h-8 px-3">
              {isAuthenticated ? (
                <Link
                  to={preferredMailboxId ? "/$mailboxId/inbox" : "/get-started"}
                  params={
                    preferredMailboxId
                      ? { mailboxId: String(preferredMailboxId) }
                      : undefined
                  }
                >
                  Open Petit
                </Link>
              ) : (
                <Link to="/login">Start 7 day free trial</Link>
              )}
            </Button>
            <Button asChild variant="outline" size="default" className="h-8 px-3">
              <Link to="/docs">Read docs</Link>
            </Button>
          </motion.div>
        </section>

        <section className="mb-10">
          <div className="mx-auto w-full max-w-3xl">
            <p className="text-xs tracking-[0.12em] text-neutral-500 uppercase">
              Why Petit
            </p>
            <ul className="mt-3 divide-y divide-neutral-200/70">
              {FEATURES.map((item, index) => (
                <motion.li
                  key={item}
                  className="py-3 text-sm text-neutral-700 sm:text-[0.95rem]"
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{
                    duration: 0.22,
                    delay: index * 0.04,
                    ease: easeOut,
                  }}
                >
                  {item}
                </motion.li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-neutral-500">
              Simple pricing: $5/month including VAT.
            </p>
          </div>
        </section>

        <footer className="mt-auto flex flex-col items-center justify-between gap-3 pt-8 text-xs text-neutral-400 sm:flex-row">
          <p>Petit</p>
          <div className="flex items-center gap-4">
            {FOOTER_LINKS.map((label) => (
              <Link
                to="/"
                key={label}
                className="transition-colors duration-150 hover:text-neutral-700"
                onClick={(event) => event.preventDefault()}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/docs"
              className="transition-colors duration-150 hover:text-neutral-700"
            >
              Docs
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
