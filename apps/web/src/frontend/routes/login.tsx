import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});

function LoginRoute() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsPending(true);

    const result = await signIn.social({
      provider: "google",
      callbackURL: "/get-started",
    });

    if (result?.error) {
      setError(result.error.message || "Google sign in failed.");
      setIsPending(false);
      return;
    }

    setIsPending(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-sm space-y-5 rounded border border-border bg-card p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">Clientito</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in with Google to sync Gmail and manage your CRM.
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={() => {
            void handleGoogleSignIn();
          }}
          disabled={isPending}
        >
          {isPending ? "Redirecting..." : "Continue with Google"}
        </Button>

        {error ? (
          <p className="text-center text-xs text-destructive">{error}</p>
        ) : null}
      </section>
    </div>
  );
}
