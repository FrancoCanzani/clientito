import { AppSidebar } from "@/components/app_sidebar";
import { useAuth } from "@/features/auth/api/auth_api";
import { authClient } from "@/lib/auth_client";
import {
  createFileRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardRouteLayout,
});

function DashboardRouteLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-foreground">
      <div className="mx-auto flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[#e2e8f0] bg-[#fbfdff] px-4 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">
                Workspace
              </div>
              {user?.email && (
                <div className="truncate text-xs text-[#64748b]">
                  {user.email}
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 px-4 py-4">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
