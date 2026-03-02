import { Input } from "@/components/ui/input";
import { getRouteApi, Link } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";

const peopleRouteApi = getRouteApi("/_dashboard/people/");

export default function PeopleListPage() {
  const navigate = peopleRouteApi.useNavigate();
  const search = peopleRouteApi.useSearch();
  const peopleResponse = peopleRouteApi.useLoaderData();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight">People</h1>
        <Input
          value={search.q ?? ""}
          onChange={(event) =>
            navigate({
              search: {
                q: event.target.value.trim() || undefined,
              },
              replace: true,
            })
          }
          placeholder="Search by name or email"
          className="sm:max-w-xs"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr_0.8fr] gap-3 border-b border-border/80 bg-muted/30 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span>Name</span>
          <span>Email</span>
          <span>Company</span>
          <span>Last Contacted</span>
        </div>
        {peopleResponse.data.length > 0 ? (
          peopleResponse.data.map((person) => (
            <Link
              key={person.id}
              to="/people/$personId"
              params={{ personId: String(person.id) }}
              className="grid grid-cols-[1.2fr_1.2fr_1fr_0.8fr] gap-3 border-b border-border/50 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/40"
            >
              <span className="truncate font-medium">{person.name ?? "(No name)"}</span>
              <span className="truncate text-muted-foreground">{person.email}</span>
              <span className="truncate text-muted-foreground">
                {person.companyName ?? person.companyDomain ?? "Independent"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {person.lastContactedAt
                  ? formatDistanceToNowStrict(new Date(person.lastContactedAt), {
                      addSuffix: true,
                    })
                  : "Never"}
              </span>
            </Link>
          ))
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No people found.
          </p>
        )}
      </div>
    </div>
  );
}
