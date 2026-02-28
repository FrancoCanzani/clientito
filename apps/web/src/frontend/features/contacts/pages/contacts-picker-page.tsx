import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTimestamp } from "@/lib/dates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCustomersFromContacts,
  fetchContactsPaginated,
  type Contact,
} from "../api";

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "live.com",
]);

const COMMON_SECOND_LEVEL_TLDS = new Set([
  "co.uk",
  "com.ar",
  "com.au",
  "com.br",
  "com.mx",
  "com.tr",
  "co.jp",
  "co.in",
]);

type ViewMode = "companies" | "people";
type SortOption = "activity" | "az" | "za";

type CompanyGroup = {
  key: string;
  companyName: string;
  domain: string;
  contacts: Contact[];
  totalEmails: number;
  isPersonal: boolean;
};

function contactLabel(contact: Contact): string {
  return (contact.name?.trim() || contact.email).toLowerCase();
}

function sortContacts(contacts: Contact[], sort: SortOption): Contact[] {
  const sorted = [...contacts];

  if (sort === "activity") {
    sorted.sort((a, b) => {
      if (a.emailCount !== b.emailCount) return b.emailCount - a.emailCount;
      const aDate = a.latestEmailDate ?? 0;
      const bDate = b.latestEmailDate ?? 0;
      if (aDate !== bDate) return bDate - aDate;
      return contactLabel(a).localeCompare(contactLabel(b));
    });
    return sorted;
  }

  const multiplier = sort === "az" ? 1 : -1;
  sorted.sort((a, b) => multiplier * contactLabel(a).localeCompare(contactLabel(b)));
  return sorted;
}

function toRootDomain(domain: string): string {
  const normalized = domain.trim().toLowerCase();
  const parts = normalized.split(".").filter(Boolean);
  if (parts.length <= 2) return normalized;

  const lastTwo = parts.slice(-2).join(".");
  if (COMMON_SECOND_LEVEL_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }

  return lastTwo;
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function toCompanyName(domain: string): string {
  const label = domain.split(".")[0] ?? domain;
  const cleaned = label
    .replace(/[-_]+/g, " ")
    .replace(
      /\b(mail|email|mailer|notify|notification|notifications|news|noreply|comms|marketing|push|send|sg)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return toTitleCase(label);
  return toTitleCase(cleaned);
}

function groupByCompany(contacts: Contact[], sort: SortOption): CompanyGroup[] {
  const map = new Map<string, Contact[]>();
  for (const c of contacts) {
    const key = toRootDomain(c.domain || "unknown");
    const list = map.get(key) ?? [];
    list.push(c);
    map.set(key, list);
  }

  const groups: CompanyGroup[] = [];
  for (const [domain, domainContacts] of map) {
    const sortedContacts = sortContacts(domainContacts, sort);
    groups.push({
      key: domain,
      companyName: toCompanyName(domain),
      domain,
      contacts: sortedContacts,
      totalEmails: domainContacts.reduce((sum, c) => sum + c.emailCount, 0),
      isPersonal: PERSONAL_DOMAINS.has(domain),
    });
  }

  if (sort === "activity") {
    groups.sort((a, b) => {
      if (a.isPersonal !== b.isPersonal) return a.isPersonal ? 1 : -1;
      if (a.totalEmails !== b.totalEmails) return b.totalEmails - a.totalEmails;
      return a.companyName.localeCompare(b.companyName);
    });
    return groups;
  }

  const multiplier = sort === "az" ? 1 : -1;
  groups.sort((a, b) => multiplier * a.companyName.localeCompare(b.companyName));
  return groups;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function ContactCheckboxRow({
  contact,
  selected,
  onToggle,
}: {
  contact: Contact;
  selected: boolean;
  onToggle: (email: string) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 px-4 py-2 text-sm ${
        contact.isAlreadyCustomer ? "opacity-50" : "cursor-pointer hover:bg-accent/50"
      }`}
    >
      <input
        type="checkbox"
        checked={contact.isAlreadyCustomer || selected}
        disabled={contact.isAlreadyCustomer}
        onChange={() => onToggle(contact.email)}
        className="h-3.5 w-3.5 rounded border-border accent-primary"
      />
      <div className="min-w-0 flex-1">
        <span className="truncate">
          {contact.name ? `${contact.name} ` : ""}
          <span className="text-muted-foreground">{contact.email}</span>
        </span>
      </div>
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {contact.emailCount}
      </Badge>
      {contact.isAlreadyCustomer && (
        <Badge className="shrink-0 text-[10px]">Customer</Badge>
      )}
    </label>
  );
}

function PersonRow({
  contact,
  selected,
  onToggle,
}: {
  contact: Contact;
  selected: boolean;
  onToggle: (email: string) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 px-4 py-3 text-sm ${
        contact.isAlreadyCustomer ? "opacity-50" : "cursor-pointer hover:bg-accent/50"
      }`}
    >
      <input
        type="checkbox"
        checked={contact.isAlreadyCustomer || selected}
        disabled={contact.isAlreadyCustomer}
        onChange={() => onToggle(contact.email)}
        className="h-3.5 w-3.5 rounded border-border accent-primary"
      />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {getInitials(contact.name, contact.email)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {contact.name || contact.email}
        </p>
        {contact.name && (
          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {contact.emailCount}
        </Badge>
        {contact.latestEmailDate && (
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTimestamp(contact.latestEmailDate)}
          </span>
        )}
        {contact.isAlreadyCustomer && (
          <Badge className="text-[10px]">Customer</Badge>
        )}
      </div>
    </label>
  );
}

function CompanyGroupCard({
  group,
  expanded,
  onToggleExpand,
  selectedEmails,
  onToggle,
  onToggleAll,
}: {
  group: CompanyGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  selectedEmails: Set<string>;
  onToggle: (email: string) => void;
  onToggleAll: (emails: string[], selected: boolean) => void;
}) {
  const selectableContacts = group.contacts.filter((c) => !c.isAlreadyCustomer);
  const allSelected =
    selectableContacts.length > 0 &&
    selectableContacts.every((c) => selectedEmails.has(c.email));
  const someSelected =
    !allSelected && selectableContacts.some((c) => selectedEmails.has(c.email));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {selectableContacts.length > 1 && (
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={() =>
                onToggleAll(
                  selectableContacts.map((c) => c.email),
                  !allSelected,
                )
              }
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            className="h-5 w-5 rounded border text-xs text-muted-foreground hover:border-border hover:text-foreground"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${group.companyName}`}
          >
            {expanded ? "-" : "+"}
          </button>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{group.companyName}</CardTitle>
            <p className="truncate text-[10px] text-muted-foreground">{group.domain}</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {group.contacts.length} contact{group.contacts.length !== 1 ? "s" : ""}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {group.totalEmails} emails
          </span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-0">
          <div className="divide-y">
            {group.contacts.map((contact) => (
              <ContactCheckboxRow
                key={contact.email}
                contact={contact}
                selected={selectedEmails.has(contact.email)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function ContactsPickerContent({
  orgId,
  onClose,
}: {
  orgId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout>>();
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showPersonal, setShowPersonal] = useState(false);
  const [sort, setSort] = useState<SortOption>("activity");
  const [viewMode, setViewMode] = useState<ViewMode>("companies");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [offset, setOffset] = useState(0);

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounceTimer);
    setDebounceTimer(
      setTimeout(() => {
        setDebouncedSearch(value);
        setOffset(0);
        setAllContacts([]);
        setExpandedGroups(new Set());
      }, 300),
    );
  }

  const contactsQuery = useQuery({
    queryKey: ["contacts", orgId, debouncedSearch, offset],
    queryFn: () =>
      fetchContactsPaginated(orgId, debouncedSearch || undefined, {
        limit: 100,
        offset,
      }),
  });

  const currentData = contactsQuery.data?.data ?? [];
  const displayContacts = offset === 0 ? currentData : [...allContacts, ...currentData];
  const pagination = contactsQuery.data?.pagination;

  const sortedContacts = useMemo(
    () => sortContacts(displayContacts, viewMode === "people" ? "az" : sort),
    [displayContacts, sort, viewMode],
  );

  const groups = useMemo(
    () => groupByCompany(displayContacts, sort),
    [displayContacts, sort],
  );

  const businessGroups = groups.filter((g) => !g.isPersonal);
  const personalGroups = groups.filter((g) => g.isPersonal);

  function handleToggle(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function handleToggleAll(emails: string[], selected: boolean) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      for (const email of emails) {
        if (selected) next.add(email);
        else next.delete(email);
      }
      return next;
    });
  }

  function handleToggleGroup(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function handleLoadMore() {
    if (!pagination) return;
    setAllContacts(displayContacts);
    setOffset(pagination.offset + pagination.limit);
  }

  const createCustomers = useMutation({
    mutationFn: () =>
      createCustomersFromContacts(orgId, Array.from(selectedEmails)),
    onSuccess: () => {
      setSelectedEmails(new Set());
      queryClient.invalidateQueries({ queryKey: ["contacts", orgId] });
      queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
      queryClient.invalidateQueries({ queryKey: ["sync-status", orgId] });
      onClose();
    },
  });

  if (contactsQuery.isLoading && offset === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <Button
          variant={viewMode === "companies" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("companies")}
        >
          Companies
        </Button>
        <Button
          variant={viewMode === "people" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("people")}
        >
          People
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search companies or contacts..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="min-w-[220px] flex-1"
        />

        {viewMode === "companies" && (
          <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
            <SelectTrigger className="h-8 min-w-[150px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activity">Most active</SelectItem>
              <SelectItem value="az">A-Z</SelectItem>
              <SelectItem value="za">Z-A</SelectItem>
            </SelectContent>
          </Select>
        )}

        {pagination && (
          <span className="text-xs text-muted-foreground">
            {pagination.total} contacts
          </span>
        )}
      </div>

      {viewMode === "companies" ? (
        <>
          {businessGroups.map((group) => (
            <CompanyGroupCard
              key={group.key}
              group={group}
              expanded={expandedGroups.has(group.key)}
              onToggleExpand={() => handleToggleGroup(group.key)}
              selectedEmails={selectedEmails}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
            />
          ))}

          {personalGroups.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowPersonal(!showPersonal)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <span>{showPersonal ? "▼" : "▶"}</span>
                Personal emails ({personalGroups.reduce((s, g) => s + g.contacts.length, 0)})
              </button>

              {showPersonal && (
                <div className="mt-2 space-y-4">
                  {personalGroups.map((group) => (
                    <CompanyGroupCard
                      key={group.key}
                      group={group}
                      expanded={expandedGroups.has(group.key)}
                      onToggleExpand={() => handleToggleGroup(group.key)}
                      selectedEmails={selectedEmails}
                      onToggle={handleToggle}
                      onToggleAll={handleToggleAll}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {sortedContacts.map((contact) => (
                <PersonRow
                  key={contact.email}
                  contact={contact}
                  selected={selectedEmails.has(contact.email)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pagination?.hasMore && (
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={contactsQuery.isFetching}
          >
            {contactsQuery.isFetching ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}

      {selectedEmails.size > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedEmails.size} contact{selectedEmails.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            onClick={() => createCustomers.mutate()}
            disabled={createCustomers.isPending}
          >
            {createCustomers.isPending
              ? "Saving..."
              : `Save ${selectedEmails.size} as customers`}
          </Button>
        </div>
      )}
    </div>
  );
}
