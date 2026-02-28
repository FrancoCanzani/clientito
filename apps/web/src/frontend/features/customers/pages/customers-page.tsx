import { getRouteApi, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatRelativeTimestamp } from "@/lib/dates";
import { fetchCustomers } from "@/features/customers/api";
import ContactsPickerContent from "@/features/contacts/pages/contacts-picker-page";

const STATUS_DOT_COLORS: Record<string, string> = {
  healthy: "bg-green-500",
  at_risk: "bg-amber-500",
  churned: "bg-red-500",
  new: "bg-blue-500",
};

type SortOption = "name-asc" | "name-desc" | "activity-desc" | "emails-desc";

function parseSortOption(value: SortOption) {
  const [sortBy, order] = value.split("-") as [
    "name" | "activity" | "emails",
    "asc" | "desc",
  ];
  return { sortBy, order };
}

const organizationRouteApi = getRouteApi("/_dashboard/$orgId");

export default function CustomersPage() {
  const { orgId } = organizationRouteApi.useLoaderData();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout>>();
  const [importOpen, setImportOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => setDebouncedSearch(value), 300));
  }

  const { sortBy, order } = parseSortOption(sortOption);

  const customersQuery = useInfiniteQuery({
    queryKey: ["customers", orgId, debouncedSearch, sortOption],
    queryFn: async ({ pageParam }) =>
      fetchCustomers(orgId, {
        search: debouncedSearch || undefined,
        sortBy,
        order,
        limit: 50,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
  });

  const displayCustomers = useMemo(
    () => customersQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [customersQuery.data],
  );
  const totalCustomers = customersQuery.data?.pages[0]?.pagination.total ?? 0;

  const handleOpenChange = useCallback((open: boolean) => {
    setImportOpen(open);
  }, []);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !customersQuery.hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (customersQuery.isFetchingNextPage || customersQuery.isFetching) return;
        void customersQuery.fetchNextPage();
      },
      { root: null, rootMargin: "200px 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [
    customersQuery,
    customersQuery.fetchNextPage,
    customersQuery.hasNextPage,
    customersQuery.isFetching,
    customersQuery.isFetchingNextPage,
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Customers</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {totalCustomers > 0 ? `${totalCustomers} total` : null}
          </span>
          <Dialog open={importOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Import from emails
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Select your customers</DialogTitle>
                <DialogDescription>
                  Choose which contacts are customers. Your own email is excluded.
                </DialogDescription>
              </DialogHeader>
              <ContactsPickerContent
                orgId={orgId}
                onClose={() => setImportOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Button size="sm" asChild>
            <Link to="/$orgId/customers/new" params={{ orgId }}>
              New customer
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by name, company, or email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1"
        />
        <Select
          value={sortOption}
          onValueChange={(value) => setSortOption(value as SortOption)}
        >
          <SelectTrigger className="h-9 w-[160px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="activity-desc">Recent activity</SelectItem>
            <SelectItem value="emails-desc">Most emails</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {customersQuery.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded" />
          ))}
        </div>
      ) : displayCustomers.length > 0 ? (
        <div className="divide-y rounded border">
          {displayCustomers.map((customer) => (
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
                    ? ` · Last email ${formatRelativeTimestamp(customer.latestEmailDate)}`
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
          {customersQuery.hasNextPage && (
            <div
              ref={loadMoreRef}
              className="py-3 text-center text-xs text-muted-foreground"
            >
              {customersQuery.isFetchingNextPage
                ? "Loading more..."
                : "Scroll for more"}
            </div>
          )}
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
