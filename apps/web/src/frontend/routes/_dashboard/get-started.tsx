import { createFileRoute } from "@tanstack/react-router";
import GetStartedPage from "@/features/onboarding/pages/get-started-page";

export const Route = createFileRoute("/_dashboard/get-started")({
  component: GetStartedPage,
});
