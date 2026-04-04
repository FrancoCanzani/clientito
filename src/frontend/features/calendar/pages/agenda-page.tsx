import { PageHeader } from "@/components/page-header";
import { AgendaPanel } from "@/features/calendar/components/agenda-panel";
import { getRouteApi } from "@tanstack/react-router";

const agendaRoute = getRouteApi("/_dashboard/$mailboxId/agenda");

export default function AgendaPage() {
  const events = agendaRoute.useLoaderData();

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6">
      <PageHeader title="Agenda" />
      <div className="flex min-h-0 flex-1 flex-col">
        <AgendaPanel events={events} />
      </div>
    </div>
  );
}
