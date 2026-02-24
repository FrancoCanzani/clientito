import { fetchOrganizations } from "@/features/workspace/workspace-api";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ location }) => {
    const organizations = (await fetchOrganizations()).data;
    const firstOrganization = organizations[0];
    const onGetStartedRoute = location.pathname === "/get-started";

    if (!firstOrganization && !onGetStartedRoute) {
      throw redirect({ to: "/get-started" });
    }

    if (firstOrganization && onGetStartedRoute) {
      throw redirect({
        to: "/$orgId/projects",
        params: { orgId: firstOrganization.id },
        replace: true,
      });
    }

    return { organizations };
  },
});
