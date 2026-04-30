import { SidebarProvider } from "@/components/ui/sidebar";
import { getRouteApi } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { InboxSidebar } from "./inbox-sidebar";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

export function InboxSidebarShell({ children }: { children: ReactNode }) {
  const { mailboxId } = mailboxRoute.useParams();

  return (
    <SidebarProvider
      className="h-full overscroll-none
 min-h-0 flex-1 overflow-hidden"
    >
      <InboxSidebar mailboxId={mailboxId} />
      <main className="flex min-h-0 flex-1 overflow-hidden bg-sidebar dark:bg-background">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background md:px-2">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
