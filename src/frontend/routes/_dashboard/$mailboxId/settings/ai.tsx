import AiPage from "@/features/settings/pages/ai-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/settings/ai")({
 component: AiPage,
});
