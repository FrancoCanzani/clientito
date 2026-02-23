import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useLogin } from "@/features/auth/api/auth_api";
import { loginFormSchema } from "@/features/auth/auth_schemas";

export function LoginPage() {
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
      navigate({ to: "/projects" });
    } catch {
      // error is shown from mutation state
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4">
      <section className="w-full max-w-sm space-y-5 rounded-lg border border-[#e2e8f0] bg-white p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[#0f172a]">ReleaseLayer</h1>
          <p className="mt-1 text-xs text-[#64748b]">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-[#334155]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs shadow-sm focus:border-[#60a5fa] focus:outline-none focus:ring-1 focus:ring-[#60a5fa]"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-[#334155]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs shadow-sm focus:border-[#60a5fa] focus:outline-none focus:ring-1 focus:ring-[#60a5fa]"
          />
        </div>

        {(formError || login.error) && <p className="text-xs text-red-600">{formError ?? login.error?.message}</p>}

        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded-md bg-[#0369a1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#075985] disabled:opacity-50"
        >
          {login.isPending ? "Signing in..." : "Sign in"}
        </button>
        </form>

        <p className="text-center text-xs text-[#64748b]">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-medium text-[#0369a1] hover:text-[#075985]">
            Sign up
          </Link>
        </p>
      </section>
    </div>
  );
}
