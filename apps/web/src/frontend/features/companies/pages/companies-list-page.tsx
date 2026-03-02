import { Input } from "@/components/ui/input";
import { getRouteApi, Link } from "@tanstack/react-router";
import { format } from "date-fns";

const companiesRouteApi = getRouteApi("/_dashboard/companies/");

export default function CompaniesListPage() {
  const navigate = companiesRouteApi.useNavigate();
  const search = companiesRouteApi.useSearch();
  const companiesResponse = companiesRouteApi.useLoaderData();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Companies</h1>
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
          placeholder="Search by name or domain"
          className="sm:max-w-xs"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1.2fr_1fr_0.6fr_0.8fr] gap-3 border-b border-border/80 bg-muted/30 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span>Name</span>
          <span>Domain</span>
          <span>People</span>
          <span>Created</span>
        </div>
        {companiesResponse.data.length > 0 ? (
          companiesResponse.data.map((company) => (
            <Link
              key={company.id}
              to="/companies/$companyId"
              params={{ companyId: String(company.id) }}
              className="grid grid-cols-[1.2fr_1fr_0.6fr_0.8fr] gap-3 border-b border-border/50 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/40"
            >
              <span className="truncate font-medium">{company.name ?? "(Unnamed company)"}</span>
              <span className="truncate text-muted-foreground">{company.domain}</span>
              <span className="text-muted-foreground">{company.peopleCount}</span>
              <span className="truncate text-xs text-muted-foreground">
                {format(new Date(company.createdAt), "PPP")}
              </span>
            </Link>
          ))
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No companies found.
          </p>
        )}
      </div>
    </div>
  );
}
