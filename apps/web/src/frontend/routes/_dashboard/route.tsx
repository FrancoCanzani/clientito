import { CommandPalette } from "@/components/command-palette";
import { Loading } from "@/components/loading";
import { EmailCommandProvider } from "@/features/emails/hooks/use-email-command-state";
import { GmailConnectionGate } from "@/features/home/components/gmail-connection-gate";
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
    <EmailCommandProvider>
      <div className="min-h-screen">
        <main className="px-4 py-4 pb-24 *:mx-auto *:max-w-4xl">
          <GmailConnectionGate />
          <Outlet />
        </main>
        <CommandPalette />
      </div>
    </EmailCommandProvider>
  );
}
