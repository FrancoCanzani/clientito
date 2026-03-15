import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TaskEditor } from "@/features/tasks/components/task-editor";
import { createTask, deleteTask, updateTask } from "@/features/tasks/mutations";
import type { Task } from "@/features/tasks/types";
import {
  buildTaskSections,
  fromTaskDateInputValue,
  getPriorityClassName,
} from "@/features/tasks/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";

const tasksRouteApi = getRouteApi("/_dashboard/tasks");

type EditorState =
  | { mode: "create"; dueAt: number | null }
  | { mode: "edit"; taskId: number }
  | null;

function getDefaultCreateDueAt() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.getTime();
}

export default function TasksPage() {
  const taskResponse = tasksRouteApi.useLoaderData();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortMode, setSortMode] = useState<"date" | "priority">("date");
  const [editor, setEditor] = useState<EditorState>(null);

  const tasks = taskResponse.data;

  const visibleTasks = useMemo(
    () => tasks.filter((task) => (showCompleted ? true : !task.done)),
    [showCompleted, tasks],
  );
  const sections = useMemo(
    () => buildTaskSections(visibleTasks, sortMode),
    [sortMode, visibleTasks],
  );
  const editingTask =
    editor?.mode === "edit"
      ? (tasks.find((task) => task.id === editor.taskId) ?? null)
      : null;

  const closeEditor = () => setEditor(null);

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      closeEditor();
      router.invalidate();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      input,
    }: {
      taskId: number;
      input: Parameters<typeof updateTask>[1];
    }) => updateTask(taskId, input),
    onSuccess: () => {
      closeEditor();
      router.invalidate();
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: (task: Task) => updateTask(task.id, { done: !task.done }),
    onSuccess: () => {
      router.invalidate();
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      closeEditor();
      void router.invalidate();
    },
  });

  const openCreateEditor = (dueAt: number | null = getDefaultCreateDueAt()) => {
    setEditor({ mode: "create", dueAt });
  };

  const openTaskEditor = (taskId: number) => {
    setEditor((current) =>
      current?.mode === "edit" && current.taskId === taskId
        ? null
        : { mode: "edit", taskId },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <header className="space-y-1">
          <h2 className="text-lg font-medium">Tasks</h2>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setSortMode("date")}
          >
            Date
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => setSortMode("priority")}
          >
            Priority
          </Button>
          <div className="flex items-center justify-center gap-2">
            <Checkbox
              checked={showCompleted}
              onCheckedChange={(checked) => setShowCompleted(checked === true)}
            />
            <Label className="text-primary">Show completed</Label>
          </div>
        </div>
      </div>

      {!isMobile && editor?.mode === "create" ? (
        <TaskEditor
          key={`create-${editor.dueAt ?? "none"}`}
          defaultDueAt={editor.dueAt}
          submitLabel="Create task"
          autoFocus
          isSubmitting={createTaskMutation.isPending}
          onCancel={closeEditor}
          onSubmit={(value) =>
            createTaskMutation.mutate({
              ...value,
              dueAt: value.dueAt ?? undefined,
            })
          }
        />
      ) : null}

      <div className="space-y-5">
        {sections.length > 0 ? (
          sections.map((section) => (
            <section key={section.key} className="space-y-2">
              <div className="flex items-center justify-between py-1">
                <h2 className="text-xs font-medium">{section.title}</h2>
                <Button
                  variant="outline"
                  size="xs"
                  className="border-border/50"
                  onClick={() =>
                    openCreateEditor(
                      section.key === "no-date"
                        ? null
                        : fromTaskDateInputValue(section.key),
                    )
                  }
                >
                  Add task
                </Button>
              </div>

              <div className="space-y-0.5">
                {section.tasks.map((task) => {
                  const isEditing =
                    !isMobile &&
                    editor?.mode === "edit" &&
                    editor.taskId === task.id;

                  return (
                    <div key={task.id} className="space-y-2">
                      <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/35">
                        <Checkbox
                          checked={task.done}
                          className="rounded-full size-3.5"
                          onCheckedChange={() =>
                            toggleTaskMutation.mutate(task)
                          }
                        />

                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openTaskEditor(task.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <p
                                className={`text-sm ${
                                  task.done
                                    ? "text-muted-foreground line-through"
                                    : "text-foreground"
                                }`}
                              >
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            <Badge
                              variant="outline"
                              className={cn(
                                "capitalize text-xs",
                                getPriorityClassName(task.priority),
                              )}
                            >
                              {task.priority}
                            </Badge>
                          </div>
                        </button>
                      </div>

                      {isEditing ? (
                        <TaskEditor
                          key={`edit-${task.id}`}
                          task={task}
                          submitLabel="Save changes"
                          isSubmitting={updateTaskMutation.isPending}
                          onCancel={closeEditor}
                          onDelete={() => deleteTaskMutation.mutate(task.id)}
                          onSubmit={(value) =>
                            updateTaskMutation.mutate({
                              taskId: task.id,
                              input: value,
                            })
                          }
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <Empty className="min-h-[40vh] border-0 p-0">
            <EmptyHeader>
              <EmptyTitle>
                {tasks.length > 0 && !showCompleted
                  ? "No open tasks"
                  : "No tasks yet"}
              </EmptyTitle>
              <EmptyDescription className="text-xs">
                {tasks.length > 0 && !showCompleted
                  ? "You're all caught up. Turn on completed tasks or add a new one."
                  : "Add your first task and it will appear in the calendar list."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="pt-1">
              <Button
                className="border-border/50"
                variant="outline"
                size="xs"
                onClick={() => openCreateEditor()}
              >
                Add task
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>

      <Sheet open={isMobile && editor !== null} onOpenChange={closeEditor}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl border-0 border-t-0"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-sm">
              {editor?.mode === "edit" ? "Edit task" : "New task"}
            </SheetTitle>
          </SheetHeader>

          {editor?.mode === "create" ? (
            <TaskEditor
              key={`mobile-create-${editor.dueAt ?? "none"}`}
              defaultDueAt={editor.dueAt}
              submitLabel="Create task"
              variant="sheet"
              autoFocus
              isSubmitting={createTaskMutation.isPending}
              onCancel={closeEditor}
              onSubmit={(value) =>
                createTaskMutation.mutate({
                  ...value,
                  dueAt: value.dueAt ?? undefined,
                })
              }
            />
          ) : editingTask ? (
            <TaskEditor
              key={`mobile-edit-${editingTask.id}`}
              task={editingTask}
              submitLabel="Save changes"
              variant="sheet"
              isSubmitting={updateTaskMutation.isPending}
              onCancel={closeEditor}
              onDelete={() => deleteTaskMutation.mutate(editingTask.id)}
              onSubmit={(value) =>
                updateTaskMutation.mutate({
                  taskId: editingTask.id,
                  input: value,
                })
              }
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
