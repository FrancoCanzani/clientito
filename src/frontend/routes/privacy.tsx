import { LegalPage } from "@/features/docs/pages/legal-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: () => <LegalPage slug="privacy" />,
});
