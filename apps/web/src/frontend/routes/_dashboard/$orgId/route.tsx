import AppSidebar from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { fetchProjects } from "@/features/workspace/workspace-api";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$orgId")({
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise;
    const organizations = parentMatch.loaderData?.organizations ?? [];
    const firstOrganization = organizations[0];

    if (!firstOrganization) {
      throw redirect({ to: "/get-started", replace: true });
    }

    const orgId = params.orgId;
    const selectedOrganization = organizations.find((org) => org.id === orgId);

    if (!selectedOrganization) {
      throw redirect({
        to: "/$orgId/projects",
        params: { orgId: firstOrganization.id },
        replace: true,
      });
    }

    const projects = (await fetchProjects(orgId)).data;

    return {
      orgId,
      projects,
    };
  },
  component: DashboardOrganizationLayout,
});

function DashboardOrganizationLayout() {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />

      <SidebarInset className="min-h-screen">
        <header className="border-b px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-7 w-7" />
            </div>
          </div>

          <nav className="mt-2 flex items-center gap-2">
            <span className="rounded-md px-2 py-1 text-xs text-muted-foreground">
              Releases
            </span>
          </nav>
        </header>

        <main className="flex-1 px-4 py-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
