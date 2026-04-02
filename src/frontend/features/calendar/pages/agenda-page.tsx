import { PageHeader } from "@/components/page-header";
import { AgendaPanel } from "@/features/calendar/components/agenda-panel";

export default function AgendaPage() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6">
      <PageHeader title="Agenda" />
      <div className="flex min-h-0 flex-1 flex-col">
        <AgendaPanel days={14} />
      </div>
    </div>
  );
}
