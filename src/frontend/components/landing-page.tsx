import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "./ui/button";

const FOOTER_LINKS = ["Privacy", "Terms", "Security"];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground antialiased">
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 sm:px-7 lg:px-8">
        <header className="flex justify-end pt-6">
          <div className="flex items-center gap-4">
            <Link to="/docs" className="underline text-xl">
              Docs
            </Link>
            <Button
              asChild
              variant={"default"}
              size={"lg"}
              className="text-xl capitalize"
            >
              {isAuthenticated ? (
                <Link to="/inbox/$id" params={{ id: "all" }}>
                  Go to inbox
                </Link>
              ) : (
                <Link to="/login">Get started</Link>
              )}
            </Button>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mx-auto flex w-full max-w-4xl gap-8 flex-col items-center text-center">
            <h1 className="font-pixel text-6xl uppercase">Petit</h1>

            <h2 className="mt-5 max-w-4xl font-serif text-[2.7rem] leading-[0.94] font-normal tracking-[-0.055em] text-balance text-foreground sm:text-[4.2rem] lg:text-[5.2rem]">
              A calmer way to get your life back under control.
            </h2>

            <div className="mt-10 w-full max-w-5xl overflow-hidden rounded-xl border border-foreground/10 p-2">
              <img
                src="/ascii-art.png"
                alt="Petit landing preview"
                className="block h-auto w-full rounded-xl object-cover"
              />
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-center gap-4 py-6 text-xs text-foreground/42 sm:justify-between">
          <p className="hidden sm:block">Petit</p>
          <div className="flex items-center gap-4">
            {FOOTER_LINKS.map((label) => (
              <Link
                to="/"
                key={label}
                className="transition-colors duration-150 hover:text-foreground"
                onClick={(event) => event.preventDefault()}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/docs"
              className="transition-colors duration-150 hover:text-foreground"
            >
              Docs
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
