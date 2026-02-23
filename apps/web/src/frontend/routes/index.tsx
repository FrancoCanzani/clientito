import { createFileRoute } from "@tanstack/react-router";
import { LandingMarketing } from "@/components/landing_marketing";

export const Route = createFileRoute("/")({
  component: LandingMarketing,
});
