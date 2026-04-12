import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Button } from "./ui/button";

const easeOut = [0.23, 1, 0.32, 1] as const;

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const preferredMailboxId = getPreferredMailboxId(accounts);

  return (
    <main>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-8 sm:px-7 lg:px-8">
        <section className="flex flex-1 flex-col justify-center py-16 sm:py-20">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
            className="text-center mb-10 tracking-wide text-xl"
          >
            Petit
          </motion.span>

          <motion.h1
            className="mx-auto mt-4 max-w-3xl text-center font-serif text-3xl leading-[1.02] font-normal tracking-[-0.03em] text-balance sm:text-[3rem] lg:text-[3.6rem]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: easeOut }}
          >
            Your distraction-free Email to get things done.
          </motion.h1>

          <motion.p
            className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-neutral-600 sm:text-base"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: easeOut }}
          >
            Read less noise. Keep what matters. Delivered on your schedule.
          </motion.p>

          <motion.div
            className="mt-7 flex items-center justify-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15, ease: easeOut }}
          >
            <Button asChild className="h-9 text-lg">
              {isAuthenticated ? (
                <Link
                  to={preferredMailboxId ? "/$mailboxId/inbox" : "/inbox-redirect"}
                  params={
                    preferredMailboxId
                      ? { mailboxId: String(preferredMailboxId) }
                      : undefined
                  }
                >
                  Open Petit
                </Link>
              ) : (
                <Link to="/login">Get Started</Link>
              )}
            </Button>
          </motion.div>
        </section>

        <section className="mx-auto w-full overflow-hidden rounded-md shadow-2xl">
          <video
            className="w-full h-auto object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/landing-video-poster.jpg"
          >
            <source src="/landing-video.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </section>

        <section className="px-6 py-24 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-x-16 gap-y-20 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <h3 className="text-lg tracking-tight text-black dark:text-white">
                  Bring every inbox together
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-black/55 dark:text-white/55">
                  Connect the accounts you use and manage personal, work, and
                  side projects from one calm place.
                </p>
              </div>

              <div>
                <h3 className="text-lg tracking-tight text-black dark:text-white">
                  Stay beautifully organized
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-black/55 dark:text-white/55">
                  Keep conversations clean, sorted, and easy to find without the
                  clutter of traditional inboxes.
                </p>
              </div>

              <div>
                <h3 className="text-lg tracking-tight text-black dark:text-white">
                  Focus on what matters
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-black/55 dark:text-white/55">
                  Important messages stay visible while distractions fade into
                  the background.
                </p>
              </div>

              <div>
                <h3 className="text-lg tracking-tight text-black dark:text-white">
                  No ads. No tracking.
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-black/55 dark:text-white/55">
                  Your inbox belongs to you. Petit is private by design and free
                  from surveillance business models.
                </p>
              </div>

              <div>
                <h3 className="text-lg tracking-tight text-black dark:text-white">
                  Search instantly
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-black/55 dark:text-white/55">
                  Find people, attachments, receipts, and old conversations in
                  seconds.
                </p>
              </div>

              <div>
                <h3 className="text-lg tracking-tight text-black dark:text-white">
                  Built for speed
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-black/55 dark:text-white/55">
                  Fast, lightweight, and designed to help you clear email
                  quickly and get back to your day.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-auto flex flex-col items-center justify-between gap-3 pt-8 text-xs text-neutral-400 sm:flex-row"></footer>
      </div>
    </main>
  );
}
