import AppHeader from "@/components/app-header";
import BottomNav from "@/components/bottom-nav";
import { useActionableEmails } from "@/features/emails/hooks/use-actionable-emails";
import {
  createFileRoute,
  Outlet,
  redirect,
  useParams,
} from "@tanstack/react-router";

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
  const { orgId } = useParams({ from: "/_dashboard/$orgId" });
  useActionableEmails(orgId, true);

  return (
    <div className="min-h-screen bg-olive-50">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-4 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
