import { CommandPalette } from "@/components/command-palette/command-palette";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { AppProviders } from "@/components/providers";
import { InboxComposeProvider } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { getDashboardGate } from "@/features/onboarding/dashboard-gate";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
    const gate = await getDashboardGate();
    if (!gate.hasUser) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <AppProviders>
      <InboxComposeProvider>
        <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-background text-foreground">
          <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            <Outlet />
          </main>
          <CommandPalette />
          <KeyboardShortcutsDialog />
        </div>
      </InboxComposeProvider>
    </AppProviders>
  );
}
