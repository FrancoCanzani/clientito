import AgendaPage from "@/features/calendar/pages/agenda-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/agenda")({
  component: AgendaPage,
});
