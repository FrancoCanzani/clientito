import GetStartedPage from "@/features/home/pages/get-started-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/get-started")({
  component: GetStartedPage,
});
