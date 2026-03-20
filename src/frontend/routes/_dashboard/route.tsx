import { CommandPalette } from "@/components/command-palette/command-palette";
import { Loading } from "@/components/loading";
import { AppProviders } from "@/components/providers";
import { SyncStatusGate } from "@/components/sync-status-gate";
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
  return (
    <AppProviders>
      <div className="flex min-h-dvh flex-col antialiased">
        <main className="flex min-h-dvh w-full flex-1 flex-col px-4 py-4 pb-24">
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>
        <CommandPalette />
      </div>
      <SyncStatusGate />
    </AppProviders>
  );
}
