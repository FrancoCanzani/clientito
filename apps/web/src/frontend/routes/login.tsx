import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { CircleNotchIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

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
      callbackURL: "/home",
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
      <Button
        type="button"
        size={"lg"}
        onClick={() => {
          void handleGoogleSignIn();
        }}
        disabled={isPending}
      >
        {isPending ? <CircleNotchIcon /> : <GoogleLogoIcon />}
        Continue with Google
      </Button>

      {error ? (
        <p className="text-center text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
