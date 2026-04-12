import { authClient } from "@/lib/auth-client";

const DASHBOARD_GATE_TTL_MS = 60_000;

export type DashboardGateResult = {
  hasUser: boolean;
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
    const value = { hasUser: false };
    dashboardGateCache = {
      value,
      expiresAt: now + DASHBOARD_GATE_TTL_MS,
    };
    return value;
  }

  const value = { hasUser: true };
  dashboardGateCache = {
    value,
    expiresAt: now + DASHBOARD_GATE_TTL_MS,
  };
  return value;
}
