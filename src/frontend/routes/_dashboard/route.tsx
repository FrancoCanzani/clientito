import { CommandPalette } from "@/components/command-palette/command-palette";
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
});

function DashboardLayout() {
  return (
    <AppProviders>
      <div className="flex min-h-dvh min-w-0 flex-col">
        <main className="flex w-full min-w-0 flex-1 flex-col px-4 py-4 pb-24">
          <Outlet />
        </main>
        <CommandPalette />
      </div>
    </AppProviders>
  );
}
