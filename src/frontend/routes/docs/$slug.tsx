import DocPage from "@/features/docs/pages/doc-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/$slug")({
  component: DocPage,
});
