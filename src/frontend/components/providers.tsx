import { TooltipProvider } from "@/components/ui/tooltip";
import { EmailCommandProvider } from "@/features/inbox/hooks/use-email-command-state";
import { useAppShortcuts } from "@/hooks/use-app-shortcuts";
import { PageContextProvider } from "@/hooks/use-page-context";
import type { ReactNode } from "react";

function AppShortcutBindings() {
  useAppShortcuts();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PageContextProvider>
      <TooltipProvider skipDelayDuration={0}>
        <EmailCommandProvider>
          <AppShortcutBindings />
          {children}
        </EmailCommandProvider>
      </TooltipProvider>
    </PageContextProvider>
  );
}
