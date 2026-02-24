import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLogin } from "@/features/auth/api/auth-api";
import { loginFormSchema } from "@/features/auth/auth-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = loginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid login payload.");
      return;
    }

    setFormError(null);
    try {
      await login.mutateAsync(parsed.data);
      navigate({ to: "/get-started" });
    } catch {
      // error is shown from mutation state
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight">ReleaseLayer</h1>
          <p className="mt-1 text-xs text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1"
          />
        </div>

        {(formError || login.error) && <p className="text-xs text-destructive">{formError ?? login.error?.message}</p>}

        <Button
          type="submit"
          disabled={login.isPending}
          className="w-full"
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-primary hover:text-primary/80">
            Sign up
          </Link>
        </p>
      </section>
    </div>
  );
}
