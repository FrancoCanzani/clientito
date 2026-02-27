import { getRouteApi, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCustomers } from "@/features/customers/api";

const STATUS_DOT_COLORS: Record<string, string> = {
  healthy: "bg-green-500",
  at_risk: "bg-amber-500",
  churned: "bg-red-500",
  new: "bg-blue-500",
};

const organizationRouteApi = getRouteApi("/_dashboard/$orgId");

export default function CustomersPage() {
  const { orgId } = organizationRouteApi.useLoaderData();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout>>();

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => setDebouncedSearch(value), 300));
  }

  const customers = useQuery({
    queryKey: ["customers", orgId, debouncedSearch],
    queryFn: () =>
      fetchCustomers(orgId, {
        search: debouncedSearch || undefined,
        limit: 100,
      }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Customers</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {customers.data ? `${customers.data.pagination.total} total` : null}
          </span>
          <Button size="sm" asChild>
            <Link to="/$orgId/customers/new" params={{ orgId }}>
              New customer
            </Link>
          </Button>
        </div>
      </div>

      <Input
        placeholder="Search by name, company, or email..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {customers.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded" />
          ))}
        </div>
      ) : customers.data && customers.data.data.length > 0 ? (
        <div className="divide-y rounded border">
          {customers.data.data.map((customer) => (
            <Link
              key={customer.id}
              to="/$orgId/customers/$customerId"
              params={{ orgId, customerId: customer.id }}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {customer.summaryStatus && STATUS_DOT_COLORS[customer.summaryStatus] && (
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[customer.summaryStatus]}`}
                      title={customer.summaryStatus.replace("_", " ")}
                    />
                  )}
                  <p className="truncate text-sm font-medium">
                    {customer.name}
                  </p>
                  {customer.company && (
                    <span className="truncate text-xs text-muted-foreground">
                      {customer.company}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {customer.email}
                  {customer.latestEmailDate
                    ? ` · Last email ${formatRelative(customer.latestEmailDate)}`
                    : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {customer.emailCount}
                </Badge>
                {customer.pendingRemindersCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {customer.pendingRemindersCount}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded border py-12 text-center text-sm text-muted-foreground">
          {debouncedSearch
            ? "No customers match your search."
            : "No customers yet. Sync your Gmail to get started."}
        </div>
      )}
    </div>
  );
}

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
