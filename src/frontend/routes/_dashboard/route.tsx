import { CommandPalette } from "@/components/command-palette/command-palette";
import { Loading } from "@/components/loading";
import { AppProviders } from "@/components/providers";
import { fetchSyncStatus } from "@/features/home/queries";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

const DASHBOARD_GATE_TTL_MS = 10_000;

type DashboardGateResult = {
  hasUser: boolean;
  needsOnboarding: boolean;
};

let dashboardGateCache:
  | {
      expiresAt: number;
      value: DashboardGateResult;
    }
  | null = null;

async function getDashboardGate(): Promise<DashboardGateResult> {
  const now = Date.now();
  if (dashboardGateCache && dashboardGateCache.expiresAt > now) {
    return dashboardGateCache.value;
  }

  const session = await authClient.getSession();
  if (!session.data?.user) {
    const value = { hasUser: false, needsOnboarding: false };
    dashboardGateCache = {
      value,
      expiresAt: now + DASHBOARD_GATE_TTL_MS,
    };
    return value;
  }

  let needsOnboarding = false;
  try {
    const syncStatus = await fetchSyncStatus();
    needsOnboarding =
      !syncStatus.hasSynced &&
      (syncStatus.state === "needs_mailbox_connect" ||
        syncStatus.state === "ready_to_sync");
  } catch {
    const value = { hasUser: true, needsOnboarding: false };
    dashboardGateCache = {
      value,
      expiresAt: now + DASHBOARD_GATE_TTL_MS,
    };
    return value;
  }

  const value = { hasUser: true, needsOnboarding };
  dashboardGateCache = {
    value,
    expiresAt: now + DASHBOARD_GATE_TTL_MS,
  };
  return value;
}

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async ({ location }) => {
    const gate = await getDashboardGate();
    if (!gate.hasUser) {
      throw redirect({ to: "/login" });
    }

    if (gate.needsOnboarding && location.pathname !== "/get-started") {
      throw redirect({ to: "/get-started" });
    }

    if (!gate.needsOnboarding && location.pathname === "/get-started") {
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
