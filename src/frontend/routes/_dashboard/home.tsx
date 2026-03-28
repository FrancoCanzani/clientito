import HomePage from "@/features/home/pages/home-page";
import { fetchBriefing, fetchSyncStatus } from "@/features/home/queries";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/home")({
  loader: async () => {
    let status;

    try {
      status = await fetchSyncStatus();
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        throw redirect({ to: "/login" });
      }
      throw error;
    }

    if (
      status.state === "needs_mailbox_connect" ||
      status.state === "needs_reconnect" ||
      status.state === "error" ||
      status.state === "ready_to_sync"
    ) {
      throw redirect({ to: "/get-started" });
    }

    return fetchBriefing();
  },
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  component: HomePage,
});
