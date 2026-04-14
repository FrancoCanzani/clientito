import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { CircleNotchIcon, GoogleLogoIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

const POLICY_LINKS = ["Privacy", "Terms", "Security"];

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});

function LoginRoute() {
  const navigate = useNavigate();

  const signInMutation = useMutation({
    mutationFn: async () => {
      const result = await signIn.social({
        provider: "google",
        callbackURL: "/",
      });

      if (result?.error) {
        throw new Error(result.error.message || "Google sign in failed.");
      }
    },
    onSuccess: () => {
      navigate({ to: "/" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-medium tracking-tight">
            Welcome to Petit
          </h1>
          <p className="text-sm text-muted-foreground">
            Regain daily hours by delegating
          </p>
        </div>

        <Button
          type="button"
          size="lg"
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
          <p className="mt-4 text-center text-xs text-destructive">
            {signInMutation.error.message}
          </p>
        )}

        <div className="gap-3 flex justify-center">
          {POLICY_LINKS.map((label) => (
            <Link
              to="/"
              key={label}
              className="text-muted-foreground text-xs"
              onClick={(event) => event.preventDefault()}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
