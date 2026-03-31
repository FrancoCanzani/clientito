import HomePage from "@/features/home/pages/home-page";
import { fetchBriefing } from "@/features/home/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/home")({
  loader: () => fetchBriefing(),
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  component: HomePage,
});
