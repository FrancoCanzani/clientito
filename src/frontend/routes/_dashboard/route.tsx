import { CommandPalette } from "@/components/command-palette";
import { Loading } from "@/components/loading";
import { SyncStatusGate } from "@/components/sync-status-gate";
import { EmailCommandProvider } from "@/features/inbox/hooks/use-email-command-state";
import { PageContextProvider } from "@/hooks/use-page-context";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell,
  pendingComponent: Loading,
});

function AppShell() {
  return (
    <PageContextProvider>
      <EmailCommandProvider>
        <div className="min-h-screen">
          <main className="px-4 py-4 pb-24 *:mx-auto *:max-w-3xl">
            <Outlet />
          </main>
          <CommandPalette />
        </div>
        <SyncStatusGate />
      </EmailCommandProvider>
    </PageContextProvider>
  );
}
