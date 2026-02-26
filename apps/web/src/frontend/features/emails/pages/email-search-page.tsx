import { getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { searchEmails, markAsCustomer, type EmailSearchResult } from "@/features/emails/api";

const orgRoute = getRouteApi("/_dashboard/$orgId");

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

function EmailRow({
  email,
  orgId,
  onMarked,
}: {
  email: EmailSearchResult;
  orgId: string;
  onMarked: () => void;
}) {
  const mark = useMutation({
    mutationFn: () => markAsCustomer(orgId, email.fromAddr),
    onSuccess: onMarked,
  });

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{email.fromAddr}</p>
          {email.isCustomer && (
            <Badge variant="secondary" className="text-[10px]">
              {email.customerName ?? "customer"}
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {email.subject ?? "(no subject)"}
        </p>
        {email.snippet && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">
            {email.snippet}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[10px] text-muted-foreground">
          {formatRelative(email.date)}
        </span>
        {!email.isCustomer && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px]"
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
    </div>
  );
}

export default function EmailSearchPage() {
  const { orgId } = orgRoute.useLoaderData();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout>>();

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => setQuery(value), 300));
  }

  const results = useQuery({
    queryKey: ["email-search", orgId, query],
    queryFn: () => searchEmails(orgId, query),
    enabled: query.length > 0,
  });

  function handleMarked() {
    queryClient.invalidateQueries({ queryKey: ["email-search", orgId] });
    queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-lg font-medium">Search Emails</h2>

      <Input
        placeholder="Search by email address, name, or subject..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        autoFocus
      />

      {query.length === 0 && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Search your synced emails to find contacts and mark them as customers.
        </p>
      )}

      {results.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded" />
          ))}
        </div>
      )}

      {results.data && results.data.length > 0 && (
        <div className="divide-y rounded border">
          {results.data.map((email) => (
            <EmailRow
              key={email.id}
              email={email}
              orgId={orgId}
              onMarked={handleMarked}
            />
          ))}
        </div>
      )}

      {results.data && results.data.length === 0 && query.length > 0 && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No emails found for "{query}".
        </p>
      )}
    </div>
  );
}
