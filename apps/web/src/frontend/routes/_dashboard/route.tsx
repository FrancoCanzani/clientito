import { CommandPalette } from "@/components/command-palette";
import { Loading } from "@/components/loading";
import { useAutoGmailSync } from "@/features/dashboard/hooks/use-auto-gmail-sync";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
  pendingComponent: Loading,
});

function DashboardLayout() {
  useAutoGmailSync();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-4 pb-24">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}
