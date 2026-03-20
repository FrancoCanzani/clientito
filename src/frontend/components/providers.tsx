import { EmailCommandProvider } from "@/features/inbox/hooks/use-email-command-state";
import { PageContextProvider } from "@/hooks/use-page-context";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PageContextProvider>
      <EmailCommandProvider>{children}</EmailCommandProvider>
    </PageContextProvider>
  );
}
