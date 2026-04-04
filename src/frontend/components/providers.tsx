import { TooltipProvider } from "@/components/ui/tooltip";
import { useInboxHotkeys } from "@/lib/hotkeys/inbox-hotkeys";
import { PageContextProvider } from "@/hooks/use-page-context";
import type { ReactNode } from "react";

function InnerProviders({ children }: { children: ReactNode }) {
  useInboxHotkeys();
  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PageContextProvider>
      <TooltipProvider skipDelayDuration={0}>
        <InnerProviders>{children}</InnerProviders>
      </TooltipProvider>
    </PageContextProvider>
  );
}
