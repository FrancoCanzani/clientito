import { Badge } from "@/components/ui/badge";
import { getRouteApi, Link } from "@tanstack/react-router";
import { format } from "date-fns";

const companyRouteApi = getRouteApi("/_dashboard/companies/$companyId");

export default function CompanyDetailPage() {
  const detail = companyRouteApi.useLoaderData().data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-2xl font-semibold tracking-tight">
          {detail.company.name ?? "Unnamed company"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{detail.company.domain}</p>
        <div className="mt-3">
          <Badge variant="outline">
            Created {format(new Date(detail.company.createdAt), "PPP")}
          </Badge>
        </div>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Linked people</h2>
        {detail.people.length > 0 ? (
          <div className="space-y-2">
            {detail.people.map((person) => (
              <Link
                key={person.id}
                to="/people/$personId"
                params={{ personId: String(person.id) }}
                className="block rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted/40"
              >
                <p className="font-medium">{person.name ?? person.email}</p>
                <p className="text-xs text-muted-foreground">{person.email}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No linked people.</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Tasks</h2>
        {detail.tasks.length > 0 ? (
          <div className="space-y-2">
            {detail.tasks.map((task) => (
              <div key={task.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.dueAt ? format(new Date(task.dueAt), "PPP p") : "No due date"} |{" "}
                  {task.done ? "Done" : "Open"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tasks.</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Notes</h2>
        {detail.notes.length > 0 ? (
          <div className="space-y-2">
            {detail.notes.map((note) => (
              <div key={note.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <p>{note.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(note.createdAt), "PPP p")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No notes.</p>
        )}
      </section>
    </div>
  );
}
