import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { fetchSyncStatus } from "@/features/dashboard/api";
import GetStartedPage from "@/features/onboarding/pages/get-started-page";

export const Route = createFileRoute("/_dashboard/get-started")({
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise;
    const organizations = parentMatch.loaderData?.organizations ?? [];
    const firstOrganization = organizations[0];

    if (!firstOrganization) {
      return null;
    }

    const syncStatus = await fetchSyncStatus(firstOrganization.id).catch(
      () => null,
    );
    if (syncStatus?.hasSynced) {
      throw redirect({
        to: "/$orgId",
        params: { orgId: firstOrganization.id },
        replace: true,
      });
    }

    return null;
  },
  component: GetStartedPage,
});
