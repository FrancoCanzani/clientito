import { createFileRoute } from "@tanstack/react-router";
import { SdkConfigPage } from "@/features/sdk/pages/sdk_config_page";

export const Route = createFileRoute("/_dashboard/projects/$project_id/sdk")({
  component: SdkConfigPage,
});
