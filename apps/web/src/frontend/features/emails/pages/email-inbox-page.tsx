import { getRouteApi, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchEmails,
  markAsCustomer,
  type EmailListItem,
} from "@/features/emails/api";

const orgRoute = getRouteApi("/_dashboard/$orgId");

type FilterTab = "all" | "customers" | "unlinked";

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

function EmailListRow({
  email,
  isSelected,
  onSelect,
}: {
  email: EmailListItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 transition-colors ${
        isSelected ? "bg-accent" : "hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">{email.fromAddr}</p>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatRelative(email.date)}
        </span>
      </div>
      <p className="truncate text-xs font-medium text-foreground/80">
        {email.subject ?? "(no subject)"}
      </p>
      {email.snippet && (
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {email.snippet}
        </p>
      )}
      <div className="mt-1 flex items-center gap-1">
        {email.isCustomer && (
          <Badge variant="secondary" className="text-[10px]">
            {email.customerName ?? "customer"}
          </Badge>
        )}
      </div>
    </button>
  );
}

function EmailDetail({
  email,
  orgId,
  onMarked,
}: {
  email: EmailListItem;
  orgId: string;
  onMarked: () => void;
}) {
  const mark = useMutation({
    mutationFn: () => markAsCustomer(orgId, email.fromAddr),
    onSuccess: onMarked,
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium">
          {email.subject ?? "(no subject)"}
        </h3>
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <p>From: {email.fromAddr}</p>
          {email.toAddr && <p>To: {email.toAddr}</p>}
          <p>{new Date(email.date).toLocaleString()}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {email.isCustomer ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link
              to="/$orgId/customers/$customerId"
              params={{ orgId, customerId: email.customerId! }}
            >
              Open customer
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => mark.mutate()}
            disabled={mark.isPending}
          >
            {mark.isPending ? "Adding..." : "Mark customer"}
          </Button>
        )}
        {mark.isError && (
          <span className="text-[10px] text-destructive">Failed</span>
        )}
      </div>

      <div className="whitespace-pre-wrap rounded border p-4 text-sm leading-relaxed">
        {email.bodyText || email.snippet || "No content available."}
      </div>
    </div>
  );
}

export default function EmailInboxPage() {
  const { orgId } = orgRoute.useLoaderData();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] =
    useState<ReturnType<typeof setTimeout>>();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allEmails, setAllEmails] = useState<EmailListItem[]>([]);
  const [offset, setOffset] = useState(0);

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounceTimer);
    setDebounceTimer(
      setTimeout(() => {
        setDebouncedSearch(value);
        setOffset(0);
        setAllEmails([]);
      }, 300),
    );
  }

  function handleFilterChange(tab: FilterTab) {
    setFilter(tab);
    setOffset(0);
    setAllEmails([]);
    setSelectedId(null);
  }

  const isCustomerParam =
    filter === "customers" ? "true" : filter === "unlinked" ? "false" : undefined;

  const emailsQuery = useQuery({
    queryKey: ["emails", orgId, { search: debouncedSearch, isCustomer: isCustomerParam, offset }],
    queryFn: async () => {
      const result = await fetchEmails(orgId, {
        search: debouncedSearch || undefined,
        isCustomer: isCustomerParam,
        limit: 50,
        offset,
      });
      return result;
    },
  });

  const displayEmails =
    offset === 0
      ? emailsQuery.data?.data ?? []
      : [...allEmails, ...(emailsQuery.data?.data ?? [])];

  const pagination = emailsQuery.data?.pagination;

  function handleLoadMore() {
    if (!pagination) return;
    setAllEmails(displayEmails);
    setOffset(pagination.offset + pagination.limit);
  }

  function handleMarked() {
    queryClient.invalidateQueries({ queryKey: ["emails", orgId] });
    queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
  }

  const selectedEmail = displayEmails.find((e) => e.id === selectedId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Inbox</h2>
        {pagination && (
          <span className="text-xs text-muted-foreground">
            {pagination.total} emails
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search emails..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(["all", "customers", "unlinked"] as const).map((tab) => (
            <Button
              key={tab}
              variant={filter === tab ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs capitalize"
              onClick={() => handleFilterChange(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 rounded border" style={{ minHeight: "60vh" }}>
        {/* Left panel: email list */}
        <div className="w-2/5 shrink-0 overflow-y-auto border-r" style={{ maxHeight: "70vh" }}>
          {emailsQuery.isLoading && offset === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded" />
              ))}
            </div>
          ) : displayEmails.length > 0 ? (
            <div className="divide-y">
              {displayEmails.map((email) => (
                <EmailListRow
                  key={email.id}
                  email={email}
                  isSelected={selectedId === email.id}
                  onSelect={() => setSelectedId(email.id)}
                />
              ))}
              {pagination?.hasMore && (
                <div className="p-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={emailsQuery.isFetching}
                  >
                    {emailsQuery.isFetching ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No emails found.
            </p>
          )}
        </div>

        {/* Right panel: email detail */}
        <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "70vh" }}>
          {selectedEmail ? (
            <EmailDetail
              email={selectedEmail}
              orgId={orgId}
              onMarked={handleMarked}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select an email to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
