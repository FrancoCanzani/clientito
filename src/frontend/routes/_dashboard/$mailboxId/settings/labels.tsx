import LabelsPage from "@/features/settings/pages/labels-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/settings/labels")({
  component: LabelsPage,
});
