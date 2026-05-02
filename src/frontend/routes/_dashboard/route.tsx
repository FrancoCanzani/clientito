import { AppProviders } from "@/components/providers";
import { MailComposeProvider } from "@/features/email/mail/compose/compose-provider";
import { getDashboardGate } from "@/features/onboarding/dashboard-gate";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const CommandPalette = lazy(async () => {
  const mod = await import("@/components/command-palette/command-palette");
  return { default: mod.CommandPalette };
});

const KeyboardShortcutsDialog = lazy(async () => {
  const mod = await import("@/components/keyboard-shortcuts-dialog");
  return { default: mod.KeyboardShortcutsDialog };
});

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async () => {
    const gate = await getDashboardGate();
    if (!gate.hasUser) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <AppProviders>
      <MailComposeProvider>
        <div className="relative flex h-dvh min-w-0 flex-col overflow-hidden bg-background">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-1.5 focus:text-xs focus:font-medium focus:shadow focus:ring-2 focus:ring-ring"
          >
            Skip to main content
          </a>
          <main
            id="main-content"
            className="liquid-glass relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
          >
            <Outlet />
          </main>
          <Suspense fallback={null}>
            <CommandPalette />
            <KeyboardShortcutsDialog />
          </Suspense>
        </div>
      </MailComposeProvider>
    </AppProviders>
  );
}
