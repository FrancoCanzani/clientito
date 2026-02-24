import { createFileRoute } from "@tanstack/react-router";
import DashboardHomePage from "@/features/dashboard/pages/dashboard-home-page";

export const Route = createFileRoute("/_dashboard/$orgId/projects/")({
  component: DashboardHomePage,
});
