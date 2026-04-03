import HomePage from "@/features/home/pages/home-page";
import { fetchBriefing } from "@/features/home/queries";
import { queryClient } from "@/lib/query-client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/home")({
  loader: () =>
    queryClient.ensureQueryData({
      queryKey: ["briefing"],
      queryFn: fetchBriefing,
      staleTime: 5 * 60 * 1000,
    }),
  component: HomePage,
});
