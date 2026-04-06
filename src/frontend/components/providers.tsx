import { TooltipProvider } from "@/components/ui/tooltip";
import { PageContextProvider } from "@/hooks/use-page-context";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PageContextProvider>
      <TooltipProvider skipDelayDuration={0}>
        {children}
      </TooltipProvider>
    </PageContextProvider>
  );
}
