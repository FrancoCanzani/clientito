import DocsHomePage from "@/features/docs/pages/docs-home-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/")({
  component: DocsHomePage,
});
