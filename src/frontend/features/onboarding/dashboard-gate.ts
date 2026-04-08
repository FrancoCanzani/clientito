import { fetchSyncStatus } from "@/features/onboarding/queries";
import { authClient } from "@/lib/auth-client";

const DASHBOARD_GATE_TTL_MS = 10_000;

export type DashboardGateResult = {
  hasUser: boolean;
  needsOnboarding: boolean;
};

let dashboardGateCache:
  | {
      expiresAt: number;
      value: DashboardGateResult;
    }
  | null = null;

export async function getDashboardGate(): Promise<DashboardGateResult> {
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
