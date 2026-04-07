import { InboxComposeProvider } from "@/features/email/inbox/components/inbox-compose-provider";
import { InboxSidebarShell } from "@/features/email/inbox/components/inbox-sidebar-shell";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox")({
  component: () => (
    <InboxComposeProvider>
      <InboxSidebarShell>
        <Outlet />
      </InboxSidebarShell>
    </InboxComposeProvider>
  ),
});
