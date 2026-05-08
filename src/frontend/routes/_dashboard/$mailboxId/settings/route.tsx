import { SettingsShell } from "@/features/settings/components/settings-shell";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/settings")({
 component: SettingsRouteComponent,
});

function SettingsRouteComponent() {
 return (
 <SettingsShell>
 <Outlet />
 </SettingsShell>
 );
}
