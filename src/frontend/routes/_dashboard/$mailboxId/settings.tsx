import SettingsPage from "@/features/settings/pages/settings-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/settings")({
  component: SettingsPage,
});
