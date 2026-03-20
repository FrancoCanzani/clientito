import HomePage from "@/features/home/pages/home-page";
import {
  ApiError,
  fetchBriefing,
  fetchSyncStatus,
} from "@/features/home/queries";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/home")({
  loader: async () => {
    let status;

    try {
      status = await fetchSyncStatus();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
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
  staleTime: 30 * 60 * 1000,
  gcTime: 60 * 60 * 1000,
  component: HomePage,
});
