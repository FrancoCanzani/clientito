import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useRegister } from "@/features/auth/api/auth-api";
import { registerFormSchema } from "@/features/auth/auth-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = registerFormSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Invalid registration payload.");
      return;
    }

    setFormError(null);
    try {
      await register.mutateAsync(parsed.data);
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
          <p className="mt-1 text-xs text-muted-foreground">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1"
          />
        </div>

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
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1"
          />
        </div>

        {(formError || register.error) && <p className="text-xs text-destructive">{formError ?? register.error?.message}</p>}

        <Button
          type="submit"
          disabled={register.isPending}
          className="w-full"
        >
          {register.isPending ? "Creating account..." : "Create account"}
        </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:text-primary/80">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
