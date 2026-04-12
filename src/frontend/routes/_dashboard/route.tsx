import { CommandPalette } from "@/components/command-palette/command-palette";
import { AppProviders } from "@/components/providers";
import { InboxComposeProvider } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { KeyboardShortcutsDialog } from "@/features/email/inbox/components/shell/keyboard-shortcuts-dialog";
import { getDashboardGate } from "@/features/onboarding/dashboard-gate";
import {
  isEveningHour,
  usePreferences,
} from "@/features/settings/hooks/use-preferences";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

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
  const prefs = usePreferences();
  const warmthActive =
    prefs.warmth === "on" || (prefs.warmth === "auto" && isEveningHour());

  return (
    <AppProviders>
      <InboxComposeProvider>
        <div
          data-font={prefs.font}
          data-warmth={warmthActive ? "on" : "off"}
          style={{ fontFamily: "var(--reading-font)" }}
          className="flex min-h-dvh min-w-0 flex-col bg-background text-foreground"
        >
          <main className="flex w-full min-w-0 flex-1 flex-col">
            <Outlet />
          </main>
          <CommandPalette />
          <KeyboardShortcutsDialog />
        </div>
      </InboxComposeProvider>
    </AppProviders>
  );
}
