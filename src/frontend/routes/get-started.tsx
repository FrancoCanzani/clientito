import GetStartedPage from "@/features/home/pages/get-started-page";
import { getDashboardGate } from "@/features/home/dashboard-gate";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/get-started")({
  beforeLoad: async () => {
    const gate = await getDashboardGate();

    if (!gate.hasUser) {
      throw redirect({ to: "/login" });
    }

    if (!gate.needsOnboarding) {
      throw redirect({ to: "/home" });
    }
  },
  component: GetStartedPage,
});
