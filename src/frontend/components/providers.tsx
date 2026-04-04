import { TooltipProvider } from "@/components/ui/tooltip";
import { EmailCommandProvider } from "@/features/inbox/hooks/use-email-command-state";
import { InboxHotkeys } from "@/lib/hotkeys/inbox-hotkeys";
import { PageContextProvider } from "@/hooks/use-page-context";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PageContextProvider>
      <TooltipProvider skipDelayDuration={0}>
        <EmailCommandProvider>
          <InboxHotkeys />
          {children}
        </EmailCommandProvider>
      </TooltipProvider>
    </PageContextProvider>
  );
}
