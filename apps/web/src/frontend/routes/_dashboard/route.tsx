import { CommandPalette } from "@/components/command-palette";
import { Loading } from "@/components/loading";
import { useAutoGmailSync } from "@/features/dashboard/hooks/use-auto-gmail-sync";
import {
  PageContextProvider,
  createPageContext,
} from "@/hooks/use-page-context";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useMemo } from "react";

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
  const store = useMemo(() => createPageContext(), []);

  return (
    <PageContextProvider value={store}>
      <div className="min-h-screen">
        <main className="px-4 py-4 pb-24 [&>*]:mx-auto [&>*]:max-w-4xl">
          <Outlet />
        </main>
        <CommandPalette />
      </div>
    </PageContextProvider>
  );
}
