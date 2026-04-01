import HomePage from "@/features/home/pages/home-page";
import { fetchBriefing } from "@/features/home/queries";
import { queryClient } from "@/lib/query-client";
import { createFileRoute } from "@tanstack/react-router";

const BRIEFING_KEY = ["briefing"];
const STALE_TIME = 5 * 60 * 1000;

export const Route = createFileRoute("/_dashboard/home")({
  loader: () =>
    queryClient.ensureQueryData({
      queryKey: BRIEFING_KEY,
      queryFn: fetchBriefing,
      staleTime: STALE_TIME,
    }),
  component: HomePage,
});
