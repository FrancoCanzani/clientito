import SignaturesPage from "@/features/settings/pages/signatures-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
 "/_dashboard/$mailboxId/settings/signatures",
)({
 component: SignaturesPage,
});
