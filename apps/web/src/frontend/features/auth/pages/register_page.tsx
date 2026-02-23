import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useRegister } from "@/features/auth/api/auth_api";
import { registerFormSchema } from "@/features/auth/auth_schemas";

export function RegisterPage() {
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
          <p className="mt-1 text-xs text-[#64748b]">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-[#334155]">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs shadow-sm focus:border-[#60a5fa] focus:outline-none focus:ring-1 focus:ring-[#60a5fa]"
          />
        </div>

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
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs shadow-sm focus:border-[#60a5fa] focus:outline-none focus:ring-1 focus:ring-[#60a5fa]"
          />
        </div>

        {(formError || register.error) && <p className="text-xs text-red-600">{formError ?? register.error?.message}</p>}

        <button
          type="submit"
          disabled={register.isPending}
          className="w-full rounded-md bg-[#0369a1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#075985] disabled:opacity-50"
        >
          {register.isPending ? "Creating account..." : "Create account"}
        </button>
        </form>

        <p className="text-center text-xs text-[#64748b]">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-[#0369a1] hover:text-[#075985]">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
