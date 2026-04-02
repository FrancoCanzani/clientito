import { CommandPalette } from "@/components/command-palette/command-palette";
import { Loading } from "@/components/loading";
import { AppProviders } from "@/components/providers";
import { fetchSyncStatus } from "@/features/home/queries";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }

    let syncStatus;
    try {
      syncStatus = await fetchSyncStatus();
    } catch {
      return;
    }

    const needsOnboarding =
      !syncStatus.hasSynced &&
      (syncStatus.state === "needs_mailbox_connect" ||
        syncStatus.state === "ready_to_sync");

    if (needsOnboarding && location.pathname !== "/get-started") {
      throw redirect({ to: "/get-started" });
    }

    if (!needsOnboarding && location.pathname === "/get-started") {
      throw redirect({ to: "/home" });
    }
  },
  component: DashboardLayout,
  pendingComponent: Loading,
});

function DashboardLayout() {
  return (
    <AppProviders>
      <div className="flex min-h-dvh flex-col antialiased">
        <main className="flex min-h-dvh w-full flex-1 flex-col px-4 py-4 pb-24 md:pb-4">
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </main>
        <CommandPalette />
      </div>
    </AppProviders>
  );
}
