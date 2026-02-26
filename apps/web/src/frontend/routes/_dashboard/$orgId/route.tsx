import AppSidebar from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
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
        to: "/$orgId",
        params: { orgId: firstOrganization.id },
        replace: true,
      });
    }

    return {
      orgId,
      organization: selectedOrganization,
    };
  },
  component: DashboardOrganizationLayout,
});

function DashboardOrganizationLayout() {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />

      <SidebarInset className="min-h-screen">
        <main className="flex-1 px-4 py-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
