import { InboxSidebarShell } from "@/features/inbox/components/inbox-sidebar-shell";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox")({
  component: () => (
    <InboxSidebarShell>
      <Outlet />
    </InboxSidebarShell>
  ),
});
