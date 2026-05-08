import ScreenerPage from "@/features/email/gatekeeper/pages/screener-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/screener")({
 component: ScreenerPage,
});
