import { LegalPage } from "@/features/docs/pages/legal-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: () => <LegalPage slug="terms" />,
});
