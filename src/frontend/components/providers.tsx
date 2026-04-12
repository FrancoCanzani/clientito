import { IconContext } from "@phosphor-icons/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: "light" }}>
      <TooltipProvider skipDelayDuration={0}>
        {children}
      </TooltipProvider>
    </IconContext.Provider>
  );
}
