import DraftsPage from "@/features/inbox/pages/drafts-page";
import { draftsQueryOptions } from "@/features/inbox/queries/drafts";
import { queryClient } from "@/lib/query-client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/drafts")({
  loader: () => queryClient.ensureQueryData(draftsQueryOptions),
  component: DraftsPage,
});
