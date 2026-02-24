import { createFileRoute, redirect } from "@tanstack/react-router";
import ReleaseDetailPage from "@/features/releases/pages/release-detail-page";

export const Route = createFileRoute(
  "/_dashboard/$orgId/projects/$projectId/releases/$releaseId",
)({
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise;
    const projects = parentMatch.loaderData?.projects ?? [];
    const project = projects.find(
      (entry) => entry.id === params.projectId,
    );

    if (!project) {
      throw redirect({
        to: "/$orgId/projects",
        params: { orgId: params.orgId },
        replace: true,
      });
    }
  },
  component: ReleaseDetailPage,
});
