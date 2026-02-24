import { createFileRoute, redirect } from "@tanstack/react-router";
import ReleasesPage from "@/features/releases/pages/releases-page";

export const Route = createFileRoute("/_dashboard/$orgId/projects/$projectId/releases/")({
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
  component: ReleasesPage,
});
