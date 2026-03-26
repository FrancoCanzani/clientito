import GetStartedPage from "@/features/home/pages/get-started-page";
import { ApiError, fetchSyncStatus } from "@/features/home/queries";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/get-started")({
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

    if (status.state === "ready" || status.state === "syncing") {
      throw redirect({ to: "/home" });
    }
  },
  component: GetStartedPage,
});
