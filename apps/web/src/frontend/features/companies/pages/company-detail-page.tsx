import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchCompanyDetail, patchCompany } from "@/features/companies/api";
import { createNote, deleteNote } from "@/features/notes/api";
import { createTask, updateTask } from "@/features/tasks/api";
import { parseTaskInput } from "@/features/tasks/parse-task-input";
import { useRouteContext } from "@/hooks/use-page-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

const companyRouteApi = getRouteApi("/_dashboard/companies/$companyId");

export default function CompanyDetailPage() {
  const { companyId } = companyRouteApi.useParams();
  const loaderData = companyRouteApi.useLoaderData();
  const queryClient = useQueryClient();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");

  const detailQuery = useQuery({
    queryKey: ["company-detail", companyId],
    queryFn: () => fetchCompanyDetail(companyId),
    initialData: loaderData,
  });

  const detail = detailQuery.data.data;
  const company = detail.company;

  useRouteContext(`/companies/${companyId}`, {
    type: "company",
    id: companyId,
    name: company.name,
    domain: company.domain,
  });

  const [openTasks, setOpenTasks] = useState(
    detail.tasks.filter((t) => !t.done),
  );
  const [notes, setNotes] = useState(detail.notes);

  const patchMutation = useMutation({
    mutationFn: (data: Parameters<typeof patchCompany>[1]) =>
      patchCompany(companyId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["company-detail", companyId],
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

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const parsed = parseTaskInput(newTaskTitle);
      return createTask({
        title: parsed.title.trim(),
        dueAt: parsed.dueAt,
        companyId: Number(companyId),
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
        companyId: Number(companyId),
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

  const renderField = (
    label: string,
    field: string,
    value: string | null,
    multiline?: boolean,
  ) => {
    const display = value ?? "";
    const isEditing = editingField === field;

    return (
      <div className="flex items-baseline gap-2 text-sm">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">
          {label}
        </span>
        {isEditing ? (
          multiline ? (
            <Textarea
              autoFocus
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={() => saveField(field, display)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  saveField(field, display);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditing();
                }
              }}
              disabled={patchMutation.isPending}
              className="min-h-15 text-sm"
            />
          ) : (
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
          )
        ) : (
          <button
            type="button"
            onClick={() => startEditing(field, display)}
            className="min-w-0 truncate text-left hover:underline"
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
          {company.name ?? "Unnamed company"}
        </h1>
        {company.domain && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {company.domain}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Added{" "}
          {formatDistanceToNowStrict(new Date(company.createdAt), {
            addSuffix: true,
          })}
        </p>
      </header>

      <section className="grid gap-1.5 rounded-lg border border-border p-4">
        {renderField("Industry", "industry", company.industry)}
        {renderField("Website", "website", company.website)}
        {renderField("Description", "description", company.description, true)}
      </section>

      <Tabs defaultValue="people">
        <TabsList variant="line">
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-3">
          {detail.people.length > 0 ? (
            <div className="space-y-1">
              {detail.people.map((person) => (
                <Link
                  key={person.id}
                  to="/people/$personId"
                  params={{ personId: String(person.id) }}
                  className="flex items-center justify-between gap-3 rounded-md px-1.5 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {person.name ?? person.email}
                    </p>
                    {person.title && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {person.title}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {person.email}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No linked people.
            </p>
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
              className="min-h-15 resize-none"
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
