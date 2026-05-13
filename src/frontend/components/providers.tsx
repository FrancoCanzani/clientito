import { IconContext } from "@phosphor-icons/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReactNode } from "react";
import { DbPerfOverlay } from "./db-perf-overlay";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: "light" }}>
      <TooltipProvider skipDelayDuration={0}>
        {children}
        {import.meta.env.DEV && <DbPerfOverlay />}
      </TooltipProvider>
    </IconContext.Provider>
  );
}
