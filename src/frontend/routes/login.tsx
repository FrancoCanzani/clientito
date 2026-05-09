import { Button } from "@/components/ui/button";
import { GMAIL_SCOPES } from "@/features/onboarding/mutations";
import { signIn } from "@/lib/auth-client";
import { CircleNotchIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});

function LoginRoute() {
  const signInMutation = useMutation({
    mutationFn: async () => {
      const result = await signIn.social({
        provider: "google",
        callbackURL: "/",
        scopes: GMAIL_SCOPES,
      });

      if (result?.error) {
        throw new Error(result.error.message || "Google sign in failed.");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Duomo
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm space-y-10">
          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-medium tracking-tight">
              Welcome to Duomo
            </h1>
            <p className="text-sm text-muted-foreground">
              Regain daily hours by delegating
            </p>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => {
                signInMutation.reset();
                signInMutation.mutate();
              }}
              disabled={signInMutation.isPending}
            >
              {signInMutation.isPending ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : (
                <GoogleLogoIcon className="size-4" />
              )}
              {signInMutation.isPending
                ? "Opening Google..."
                : "Continue with Google"}
            </Button>

            {signInMutation.error && (
              <p className="text-center text-xs text-destructive">
                {signInMutation.error.message}
              </p>
            )}

            <p className="text-center text-xs text-muted-foreground">
              By continuing, you agree to our{" "}
              <Link to="/terms" className="underline hover:text-foreground">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Duomo</span>
          <nav className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
