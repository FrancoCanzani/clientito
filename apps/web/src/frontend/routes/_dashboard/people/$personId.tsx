import PersonDetailPage from "@/features/people/pages/person-detail-page";
import { fetchPersonDetail } from "@/features/people/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/people/$personId")({
  loader: async ({ params }) => fetchPersonDetail(params.personId),
  component: PersonDetailPage,
});
