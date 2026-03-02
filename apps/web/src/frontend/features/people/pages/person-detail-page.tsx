import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createNote, deleteNote } from "@/features/notes/api";
import { fetchPersonContext, fetchPersonEmails } from "@/features/people/api";
import { createTask, updateTask } from "@/features/tasks/api";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { format } from "date-fns";
import { useMemo, useState } from "react";

const personRouteApi = getRouteApi("/_dashboard/people/$personId");

export default function PersonDetailPage() {
  const { personId } = personRouteApi.useParams();
  const personDetail = personRouteApi.useLoaderData().data;
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [openTasks, setOpenTasks] = useState(personDetail.openTasks);
  const [notes, setNotes] = useState(personDetail.notes);

  const contextQuery = useQuery({
    queryKey: ["person-context", personId],
    queryFn: () => fetchPersonContext(personId),
  });

  const emailsQuery = useInfiniteQuery({
    queryKey: ["person-emails", personId],
    queryFn: ({ pageParam }) => fetchPersonEmails(personId, { limit: 20, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
  });

  const createTaskMutation = useMutation({
    mutationFn: async () =>
      createTask({
        title: newTaskTitle.trim(),
        personId: Number(personId),
        companyId: personDetail.person.companyId ?? undefined,
      }),
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
        setOpenTasks((prev) => prev.filter((task) => task.id !== updatedTask.id));
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
        companyId: personDetail.person.companyId ?? undefined,
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="border-b border-border/80 pb-4">
        <p className="text-2xl font-semibold tracking-tight">
          {personDetail.person.name ?? "Unnamed person"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{personDetail.person.email}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {personDetail.person.companyName ?? personDetail.person.companyDomain ?? "No company"}
          </Badge>
          <Badge variant="outline">
            Last contacted:{" "}
            {personDetail.person.lastContactedAt
              ? format(new Date(personDetail.person.lastContactedAt), "PPP")
              : "Never"}
          </Badge>
        </div>
      </div>

      <section className="space-y-3 border-b border-border/70 pb-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          AI Context
        </h2>
          {contextQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed">
                {contextQuery.data?.briefing ?? "No context available yet."}
              </p>
              <div className="flex flex-wrap gap-2">
                {(contextQuery.data?.suggestedActions ?? []).map((action) => (
                  <Button key={action} size="sm" variant="outline" className="rounded-full">
                    {action}
                  </Button>
                ))}
              </div>
            </>
          )}
      </section>

      <Tabs defaultValue="emails">
        <TabsList variant="line">
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="space-y-3">
          <div className="rounded-lg border border-border">
            {personEmails.length > 0 ? (
              personEmails.map((email) => (
                <div
                  key={email.id}
                  className="border-b border-border/50 px-4 py-3 text-sm last:border-b-0"
                >
                  <p className="font-medium">{email.subject ?? "(no subject)"}</p>
                  <p className="mt-1 text-muted-foreground">{email.snippet}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(email.date), "PPP p")}
                  </p>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No emails for this person.</p>
            )}
          </div>
          {emailsQuery.hasNextPage && (
            <Button
              variant="outline"
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
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Add a task"
            />
            <Button
              onClick={() => createTaskMutation.mutate()}
              disabled={createTaskMutation.isPending || newTaskTitle.trim().length === 0}
            >
              Add task
            </Button>
          </div>
          <div className="rounded-lg border border-border">
            {openTasks.length > 0 ? (
              openTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 text-sm last:border-b-0"
                >
                  <div>
                    <p>{task.title}</p>
                    {task.dueAt && (
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(task.dueAt), "PPP p")}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTaskMutation.mutate({ id: task.id, done: !task.done })}
                  >
                    {task.done ? "Reopen" : "Mark done"}
                  </Button>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No open tasks.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-3">
          <div className="space-y-2">
            <Textarea
              value={newNoteContent}
              onChange={(event) => setNewNoteContent(event.target.value)}
              placeholder="Write a note"
            />
            <Button
              onClick={() => createNoteMutation.mutate()}
              disabled={createNoteMutation.isPending || newNoteContent.trim().length === 0}
            >
              Add note
            </Button>
          </div>
          <div className="rounded-lg border border-border">
            {notes.length > 0 ? (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-3 text-sm last:border-b-0"
                >
                  <div>
                    <p className="leading-relaxed">{note.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(note.createdAt), "PPP p")}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteNoteMutation.mutate(note.id)}>
                    Delete
                  </Button>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No notes yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
