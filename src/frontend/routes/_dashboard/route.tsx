import { CommandPalette } from "@/components/command-palette/command-palette";
import { Loading } from "@/components/loading";
import { AppProviders } from "@/components/providers";
import { getDashboardGate } from "@/features/home/dashboard-gate";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async ({ location }) => {
    const gate = await getDashboardGate();
    if (!gate.hasUser) {
      throw redirect({ to: "/login" });
    }

    if (gate.needsOnboarding && location.pathname !== "/get-started") {
      throw redirect({ to: "/get-started" });
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
    </AppProviders>
  );
}
