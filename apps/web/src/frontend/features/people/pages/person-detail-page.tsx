import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createNote, deleteNote } from "@/features/notes/api";
import {
  fetchPersonContext,
  fetchPersonDetail,
  fetchPersonEmails,
  patchPerson,
} from "@/features/people/api";
import { createTask, updateTask } from "@/features/tasks/api";
import { parseTaskInput } from "@/features/tasks/parse-task-input";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const personRouteApi = getRouteApi("/_dashboard/people/$personId");

export default function PersonDetailPage() {
  const { personId } = personRouteApi.useParams();
  const loaderData = personRouteApi.useLoaderData();
  const queryClient = useQueryClient();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const detailQuery = useQuery({
    queryKey: ["person-detail", personId],
    queryFn: () => fetchPersonDetail(personId),
    initialData: loaderData,
  });

  const personDetail = detailQuery.data.data;
  const person = personDetail.person;

  const [openTasks, setOpenTasks] = useState(personDetail.openTasks);
  const [notes, setNotes] = useState(personDetail.notes);

  const patchMutation = useMutation({
    mutationFn: (data: Parameters<typeof patchPerson>[1]) =>
      patchPerson(personId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["person-detail", personId],
      });
      setEditingField(null);
      setDraftValue("");
    },
    onError: () => {
      toast.error("Failed to update");
      setEditingField(null);
      setDraftValue("");
    },
  });

  const contextQuery = useQuery({
    queryKey: ["person-context", personId],
    queryFn: () => fetchPersonContext(personId),
  });

  const emailsQuery = useInfiniteQuery({
    queryKey: ["person-emails", personId],
    queryFn: ({ pageParam }) =>
      fetchPersonEmails(personId, { limit: 20, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseTaskInput(newTaskTitle);
      return createTask({
        title: parsed.title.trim(),
        dueAt: parsed.dueAt,
        personId: Number(personId),
        companyId: person.companyId ?? undefined,
      });
    },
    onSuccess: (task) => {
      setNewTaskTitle("");
      setOpenTasks((prev) => [task, ...prev]);
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (input: { id: number; done: boolean }) =>
      updateTask(input.id, { done: input.done }),
    onSuccess: (updatedTask) => {
      if (updatedTask.done) {
        setOpenTasks((prev) =>
          prev.filter((task) => task.id !== updatedTask.id),
        );
      } else {
        setOpenTasks((prev) => [
          updatedTask,
          ...prev.filter((task) => task.id !== updatedTask.id),
        ]);
      }
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async () =>
      createNote({
        content: newNoteContent.trim(),
        personId: Number(personId),
        companyId: person.companyId ?? undefined,
      }),
    onSuccess: (note) => {
      setNewNoteContent("");
      setNotes((prev) => [note, ...prev]);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => deleteNote(noteId),
    onSuccess: (_unused, noteId) => {
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
    },
  });

  const personEmails = useMemo(
    () => emailsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [emailsQuery.data],
  );

  const startEditing = (field: string, currentValue: string) => {
    if (patchMutation.isPending) return;
    setEditingField(field);
    setDraftValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setDraftValue("");
  };

  const saveField = (field: string, currentValue: string) => {
    const trimmed = draftValue.trim();
    const normalized = trimmed.length > 0 ? trimmed : null;
    const currentNormalized = currentValue.length > 0 ? currentValue : null;

    if (normalized === currentNormalized) {
      cancelEditing();
      return;
    }

    if (field === "name" && !normalized) {
      cancelEditing();
      return;
    }

    patchMutation.mutate({ [field]: field === "name" ? trimmed : normalized });
  };

  const renderField = (label: string, field: string, value: string | null) => {
    const display = value ?? "";
    const isEditing = editingField === field;

    return (
      <div className="flex items-baseline gap-2 text-sm">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">
          {label}
        </span>
        {isEditing ? (
          <Input
            autoFocus
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={() => saveField(field, display)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveField(field, display);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEditing();
              }
            }}
            disabled={patchMutation.isPending}
            className="h-7 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => startEditing(field, display)}
            className="truncate text-left hover:underline"
          >
            {display || <span className="text-muted-foreground/50">--</span>}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-medium tracking-tight">
          {person.name ?? "Unnamed person"}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{person.email}</p>
        {person.lastContactedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Last contacted{" "}
            {formatDistanceToNowStrict(new Date(person.lastContactedAt), {
              addSuffix: true,
            })}
          </p>
        )}
      </header>

      <section className="grid gap-1.5 rounded-lg border border-border p-4">
        {renderField("Title", "title", person.title)}
        {renderField("Phone", "phone", person.phone)}
        {renderField("LinkedIn", "linkedin", person.linkedin)}
        <div className="flex items-baseline gap-2 text-sm">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">
            Company
          </span>
          <span className="truncate">
            {person.companyName ?? person.companyDomain ?? (
              <span className="text-muted-foreground/50">--</span>
            )}
          </span>
        </div>
      </section>

      {contextQuery.data && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AI Context
          </h2>
          <p className="text-sm leading-relaxed">
            {contextQuery.data.briefing}
          </p>
          {contextQuery.data.suggestedActions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {contextQuery.data.suggestedActions.map((action) => (
                <span
                  key={action}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {action}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
      {contextQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      <Tabs defaultValue="emails">
        <TabsList variant="line">
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="space-y-3">
          {personEmails.length > 0 ? (
            <div className="space-y-1">
              {personEmails.map((email) => (
                <div
                  key={email.id}
                  className="flex items-start justify-between gap-3 rounded-md px-1.5 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {email.subject ?? "(no subject)"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {email.snippet}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {format(new Date(email.date), "MMM d")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No emails for this person.
            </p>
          )}
          {emailsQuery.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => emailsQuery.fetchNextPage()}
              disabled={emailsQuery.isFetchingNextPage}
            >
              {emailsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task..."
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  newTaskTitle.trim().length > 0 &&
                  !createTaskMutation.isPending
                ) {
                  e.preventDefault();
                  createTaskMutation.mutate();
                }
              }}
            />
            <Button
              onClick={() => createTaskMutation.mutate()}
              disabled={
                createTaskMutation.isPending || newTaskTitle.trim().length === 0
              }
            >
              Add
            </Button>
          </div>
          {openTasks.length > 0 ? (
            <div className="space-y-1">
              {openTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-md px-1.5 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate">{task.title}</p>
                    {task.dueAt && (
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(task.dueAt), "MMM d, p")}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() =>
                      toggleTaskMutation.mutate({
                        id: task.id,
                        done: !task.done,
                      })
                    }
                  >
                    {task.done ? "Reopen" : "Done"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No open tasks.
            </p>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-3">
          <div className="space-y-2">
            <Textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write a note..."
              className="min-h-[60px] resize-none"
            />
            <Button
              size="sm"
              onClick={() => createNoteMutation.mutate()}
              disabled={
                createNoteMutation.isPending ||
                newNoteContent.trim().length === 0
              }
            >
              Add note
            </Button>
          </div>
          {notes.length > 0 ? (
            <div className="space-y-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group flex items-start justify-between gap-3 rounded-md px-1.5 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="leading-relaxed">{note.content}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(note.createdAt), "MMM d, p")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs opacity-0 group-hover:opacity-100"
                    onClick={() => deleteNoteMutation.mutate(note.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No notes yet.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
