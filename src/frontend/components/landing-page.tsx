import { getPreferredMailboxId } from "@/features/email/inbox/utils/mailbox";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { Link } from "@tanstack/react-router";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const accounts = useMailboxes().data?.accounts ?? [];
  const preferredMailboxId = getPreferredMailboxId(accounts);

  return (
    <main>
      <div className="mx-auto flex w-full max-w-2xl flex-col p-5 space-y-20">
        <section className="flex flex-1 flex-col justify-center items-center py-8">
          <div className="flex items-center text-sm justify-between w-full">
            <h1 className="text-muted-foreground">Duomo Email</h1>
            {isAuthenticated ? (
              <Link
                className="hover:underline underline-offset-4"
                to={preferredMailboxId ? "/$mailboxId/inbox" : "/login"}
                params={
                  preferredMailboxId
                    ? { mailboxId: String(preferredMailboxId) }
                    : undefined
                }
              >
                Open Petit
              </Link>
            ) : (
              <Link className="hover:underline underline-offset-4" to="/login">
                Get Started
              </Link>
            )}
          </div>
        </section>

        <img src="/ascii-art.png" className="h-120 w-160 mx-auto rounded-md" />

        <section className="space-y-6">
          <h2>Craft</h2>
          <p className="text-sm prose">
            For a long time frames were where all of my standards lived. I cared
            very deeply about the work and still do. I care about spacing,
            motion, and the small polish details that most people never notice
            but always feel. Those are small decisions that in my opinion,
            eventually compound into a good product. That attention to detail
            shaped how I saw myself. I was a designer in the truest sense of the
            word. My best ideas stayed in design files. I could present and
            explain them but they still depended on someone else to fully bring
            them into the world. Unless I was paired with an engineer who cares
            about craft too, I found myself having a strong pov, but not full
            control over whether that pov would ever be experienced the way I
            intended.
          </p>
        </section>

        <section className="space-y-6">
          <h2>Transition</h2>
          <p className="text-sm prose">
            For a long time frames were where all of my standards lived. I cared
            very deeply about the work and still do. I care about spacing,
            motion, and the small polish details that most people never notice
            but always feel. Those are small decisions that in my opinion,
            eventually compound into a good product. That attention to detail
            shaped how I saw myself. I was a designer in the truest sense of the
            word. My best ideas stayed in design files. I could present and
            explain them but they still depended on someone else to fully bring
            them into the world. Unless I was paired with an engineer who cares
            about craft too, I found myself having a strong pov, but not full
            control over whether that pov would ever be experienced the way I
            intended.
          </p>
        </section>

        <footer>
          <div className="flex items-center justify-between">
            <div className="">
              <ul className="space-y-3 text-muted-foreground **:text-sm hover:underline underline-offset-4">
                <li>
                  <a href="#">About</a>
                </li>
                <li>
                  <a href="#">Culture</a>
                </li>
                <li>
                  <a href="#">Teams</a>
                </li>
                <li>
                  <a href="#">Career</a>
                </li>
              </ul>
            </div>

            <div>
              <ul className="space-y-3 text-muted-foreground **:text-sm hover:underline underline-offset-4">
                <li>
                  <a href="#">LinkedIn</a>
                </li>
                <li>
                  <a href="#">Contact Us</a>
                </li>
                <li>
                  <a href="#">hello@arcus.com</a>
                </li>
              </ul>
            </div>
          </div>

          <img
            src="/footer-image.png"
            alt="Cityscape Drawing"
            className="rounded-b-md"
          />
        </footer>
      </div>
    </main>
  );
}
