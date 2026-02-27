import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchContacts } from "@/features/contacts/api";
import {
  addCustomerContact,
  fetchCustomerDetail,
  fetchCustomerSummary,
  removeCustomerContact,
  updateCustomer,
  createTask,
  updateTask,
  deleteTask,
  type Task,
  type CustomerContact,
  type CustomerEmail,
  type CustomerHealthSummary,
} from "@/features/customers/api";

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

function TaskRow({
  task,
  onUpdate,
}: {
  task: Task;
  onUpdate: () => void;
}) {
  const toggle = useMutation({
    mutationFn: () => updateTask(task.id, { done: !task.done }),
    onSuccess: onUpdate,
  });

  const remove = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: onUpdate,
  });

  const isOverdue = !task.done && task.dueAt < Date.now();

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={`h-4 w-4 shrink-0 rounded border ${task.done ? "border-primary bg-primary" : "border-muted-foreground/30"}`}
        />
        <span className={`truncate text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}>
          {task.message}
        </span>
        {isOverdue && (
          <Badge variant="destructive" className="text-[10px]">
            overdue
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[10px] text-muted-foreground">
          {new Date(task.dueAt).toLocaleDateString()}
        </span>
        <button
          type="button"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          className="text-[10px] text-muted-foreground hover:text-destructive"
        >
          remove
        </button>
      </div>
    </div>
  );
}

function AddTaskForm({
  orgId,
  customerId,
  onCreated,
}: {
  orgId: string;
  customerId: string;
  onCreated: () => void;
}) {
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createTask({
        orgId,
        customerId,
        message,
        dueAt: new Date(dueDate).getTime(),
      }),
    onSuccess: () => {
      setMessage("");
      setDueDate("");
      onCreated();
    },
  });

  return (
    <div className="flex items-end gap-2 pt-2">
      <Input
        placeholder="Task..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="flex-1"
      />
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-36"
      />
      <Button
        size="sm"
        onClick={() => create.mutate()}
        disabled={!message.trim() || !dueDate || create.isPending}
      >
        Add
      </Button>
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (value: string | null) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const [dirty, setDirty] = useState(false);

  function handleBlur() {
    if (!dirty) return;
    onSave(local.trim() || null);
    setDirty(false);
  }

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          setDirty(true);
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );
}

function CustomerEmailRow({ email }: { email: CustomerEmail }) {
  return (
    <div className="space-y-1 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-sm font-medium">
          {email.subject ?? "(no subject)"}
        </p>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatRelative(email.date)}
        </span>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {email.fromAddr}
        {email.toAddr ? ` -> ${email.toAddr}` : ""}
      </p>
      {email.snippet && (
        <p className="line-clamp-2 text-xs text-muted-foreground/80">
          {email.snippet}
        </p>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  onRemove,
  isRemoving,
}: {
  contact: CustomerContact;
  onRemove: (email: string) => void;
  isRemoving: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {contact.name || contact.email}
        </p>
        <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {contact.isPrimary && (
          <Badge variant="secondary" className="text-[10px]">
            Primary
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px]">
          {contact.emailCount} emails
        </Badge>
        <button
          type="button"
          onClick={() => onRemove(contact.email)}
          disabled={isRemoving}
          className="h-6 w-6 rounded border text-sm text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Remove ${contact.email}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  healthy: "bg-green-500",
  at_risk: "bg-amber-500",
  churned: "bg-red-500",
  new: "bg-blue-500",
  unknown: "bg-gray-400",
};

function SummaryCard({ summary }: { summary: CustomerHealthSummary }) {
  return (
    <div className="rounded border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[summary.status] ?? "bg-gray-400"}`}
          />
          <span className="text-sm font-medium capitalize">
            {summary.status.replace("_", " ")}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Confidence: {Math.round(summary.confidence * 100)}% · {new Date(summary.generatedAt).toLocaleDateString()}
        </span>
      </div>

      {summary.keyChanges.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Key Changes</p>
          <ul className="mt-1 space-y-0.5">
            {summary.keyChanges.map((change, i) => (
              <li key={i} className="text-xs">{change}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.risks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Risks</p>
          <ul className="mt-1 space-y-0.5">
            {summary.risks.map((risk, i) => (
              <li key={i} className="text-xs text-amber-600">{risk}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground">Next Best Action</p>
        <p className="mt-0.5 text-xs">{summary.nextBestAction}</p>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { orgId } = orgRoute.useLoaderData();
  const { customerId } =
    getRouteApi("/_dashboard/$orgId/customers/$customerId").useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const detail = useQuery({
    queryKey: ["customer-detail", orgId, customerId],
    queryFn: () => fetchCustomerDetail(customerId),
  });

  const summaryQuery = useQuery({
    queryKey: ["customer-summary", customerId],
    queryFn: () => fetchCustomerSummary(customerId),
    staleTime: 5 * 60 * 1000,
  });

  const [contactSearch, setContactSearch] = useState("");

  const contactsQuery = useQuery({
    queryKey: ["contacts", orgId, contactSearch],
    queryFn: () => fetchContacts(orgId, contactSearch || undefined),
  });

  const [editName, setEditName] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [notesTimeout, setNotesTimeout] = useState<ReturnType<typeof setTimeout>>();

  const customer = detail.data?.customer;
  const displayNotes = notes ?? customer?.notes ?? "";
  const displayName = editName ?? customer?.name ?? "";

  const patchMutation = useMutation({
    mutationFn: (updates: Parameters<typeof updateCustomer>[1]) =>
      updateCustomer(customerId, updates),
    onSuccess: () => invalidate(),
  });

  const addContact = useMutation({
    mutationFn: (email: string) => addCustomerContact(customerId, email),
    onSuccess: () => {
      setContactSearch("");
      invalidate();
    },
  });

  const removeContact = useMutation({
    mutationFn: (email: string) => removeCustomerContact(customerId, email),
    onSuccess: () => invalidate(),
  });

  function handleFieldSave(field: string, value: string | null) {
    patchMutation.mutate({ [field]: value });
  }

  function handleNameBlur() {
    if (editName !== null && editName.trim() && editName !== customer?.name) {
      patchMutation.mutate({ name: editName.trim() });
    }
    setEditName(null);
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    clearTimeout(notesTimeout);
    setNotesTimeout(
      setTimeout(() => {
        updateCustomer(customerId, { notes: value });
      }, 1000),
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["customer-detail", orgId, customerId] });
    queryClient.invalidateQueries({ queryKey: ["customers", orgId] });
  }

  const linkedEmails = new Set(detail.data?.contacts.map((c) => c.email) ?? []);
  const addCandidates = (contactsQuery.data ?? [])
    .filter((contact) => !linkedEmails.has(contact.email) && !contact.isAlreadyCustomer)
    .sort((a, b) => b.emailCount - a.emailCount)
    .slice(0, 12);

  if (detail.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sm text-muted-foreground">
        Customer not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <input
            value={displayName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            className="-ml-1 w-full rounded bg-transparent px-1 text-lg font-medium outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            {customer.company ? `${customer.company} · ` : ""}
            {customer.email}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: "/$orgId/customers", params: { orgId } })}
        >
          Back
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="emails">
            Emails{detail.data?.emails ? ` (${detail.data.emails.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts{detail.data?.contacts ? ` (${detail.data.contacts.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks
            {detail.data?.reminders
              ? ` (${detail.data.reminders.filter((r) => !r.done).length})`
              : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-3 pt-2">
          {summaryQuery.data && <SummaryCard summary={summaryQuery.data} />}
          {summaryQuery.isLoading && (
            <Skeleton className="h-24 w-full rounded" />
          )}
          <EditableField
            label="Company"
            value={customer.company ?? ""}
            onSave={(v) => handleFieldSave("company", v)}
            placeholder="Company name"
          />
          <EditableField
            label="Email"
            value={customer.email}
            onSave={() => {}}
            placeholder="Email"
          />
          <EditableField
            label="Phone"
            value={customer.phone ?? ""}
            onSave={(v) => handleFieldSave("phone", v)}
            placeholder="Phone number"
          />
          <EditableField
            label="Website"
            value={customer.website ?? ""}
            onSave={(v) => handleFieldSave("website", v)}
            placeholder="https://..."
          />
          <EditableField
            label="VAT / EIN"
            value={customer.vatEin ?? ""}
            onSave={(v) => handleFieldSave("vatEin", v)}
            placeholder="Tax ID"
          />
          <EditableField
            label="Address"
            value={customer.address ?? ""}
            onSave={(v) => handleFieldSave("address", v)}
            placeholder="Address"
          />
        </TabsContent>

        <TabsContent value="emails" className="pt-2">
          {detail.data?.emails && detail.data.emails.length > 0 ? (
            <div className="divide-y rounded border">
              {detail.data.emails.map((email) => (
                <CustomerEmailRow key={email.id} email={email} />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No emails linked to this customer yet.
            </p>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4 pt-2">
          {detail.data?.contacts && detail.data.contacts.length > 0 ? (
            <div className="divide-y rounded border px-3">
              {detail.data.contacts.map((contact) => (
                <ContactRow
                  key={contact.email}
                  contact={contact}
                  onRemove={(email) => removeContact.mutate(email)}
                  isRemoving={removeContact.isPending}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No contacts linked yet.</p>
          )}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Add contact</p>
            <Input
              placeholder="Search contacts..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />

            {contactsQuery.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            )}

            {!contactsQuery.isLoading && addCandidates.length > 0 && (
              <div className="divide-y rounded border">
                {addCandidates.map((contact) => (
                  <div
                    key={contact.email}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {contact.name || contact.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {contact.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addContact.mutate(contact.email)}
                      disabled={addContact.isPending}
                      className="h-6 w-6 rounded border text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Add ${contact.email}`}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!contactsQuery.isLoading && addCandidates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No matching contacts available.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Notes</span>
              <span>Auto-saves as you type</span>
            </div>

            <Textarea
              value={displayNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Write anything about this customer..."
              rows={18}
              className="min-h-[calc(100vh-16rem)] resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-7 shadow-none focus-visible:border-transparent focus-visible:ring-0"
            />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="pt-2">
          {detail.data?.reminders && detail.data.reminders.length > 0 ? (
            <div className="divide-y">
              {detail.data.reminders.map((t) => (
                <TaskRow key={t.id} task={t} onUpdate={invalidate} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No tasks yet.</p>
          )}
          <AddTaskForm orgId={orgId} customerId={customerId} onCreated={invalidate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
