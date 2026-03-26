import { PageHeader } from "@/components/page-header";
import { AgendaPanel } from "@/features/calendar/components/agenda-panel";

export default function AgendaPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Agenda" />
      <AgendaPanel days={14} />
    </div>
  );
}
