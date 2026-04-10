import { CommandPalette } from "@/components/command-palette/command-palette";
import { AppProviders } from "@/components/providers";
import { InboxComposeProvider } from "@/features/email/inbox/components/inbox-compose-provider";
import { getDashboardGate } from "@/features/onboarding/dashboard-gate";
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
  // pendingComponent: Loading,
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <AppProviders>
      <InboxComposeProvider>
        <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
          <main className="flex w-full min-h-0 min-w-0 flex-1 flex-col px-4 py-4">
            <Outlet />
          </main>
          <CommandPalette />
        </div>
      </InboxComposeProvider>
    </AppProviders>
  );
}
