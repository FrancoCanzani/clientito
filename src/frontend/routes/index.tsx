import LandingPage from "@/components/landing-page";
import { syncStatusQueryOptions } from "@/features/home/hooks/use-sync-status";
import { ApiError } from "@/features/home/queries";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      return;
    }

    try {
      const status = await queryClient.ensureQueryData({
        ...syncStatusQueryOptions,
        staleTime: 0,
      });

      throw redirect({
        to: status.state === "ready" ? "/home" : "/get-started",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: "/login" });
      }
      throw error;
    }
  },
  component: LandingPage,
});
