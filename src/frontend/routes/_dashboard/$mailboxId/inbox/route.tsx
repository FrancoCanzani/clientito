import {
  InboxSidebarShell,
} from "@/features/inbox/components/inbox-sidebar-shell";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";

const mailboxLayoutSearchSchema = z.object({
  view: z.enum(["important"]).optional(),
  compose: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox")({
  validateSearch: mailboxLayoutSearchSchema,
  component: () => (
    <InboxSidebarShell>
      <Outlet />
    </InboxSidebarShell>
  ),
});
