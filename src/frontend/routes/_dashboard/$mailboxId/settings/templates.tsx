import TemplatesPage from "@/features/settings/pages/templates-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
 "/_dashboard/$mailboxId/settings/templates",
)({
 component: TemplatesPage,
});
