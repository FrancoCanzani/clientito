import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PomodoroPill } from "@/features/tasks/components/pomodoro-pill";
import { TaskBoard } from "@/features/tasks/components/task-board";
import {
  TaskEditor,
  type TaskEditorSubmitValue,
} from "@/features/tasks/components/task-editor";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import { usePomodoro } from "@/features/tasks/hooks/use-pomodoro";
import { TaskActionsProvider } from "@/features/tasks/hooks/use-task-actions";
import { createTask, deleteTask, updateTask } from "@/features/tasks/mutations";
import type {
  TaskLayout,
  TaskPriority,
  TaskSortMode,
  TaskStatus,
  TaskView,
} from "@/features/tasks/types";
import {
  buildTaskSections,
  getDefaultCreateDueAt,
  VIEW_LABELS,
} from "@/features/tasks/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { KanbanIcon, ListIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

const tasksRouteApi = getRouteApi("/_dashboard/tasks");

type EditorState =
  | { mode: "create"; dueAt: number | null }
  | { mode: "edit"; taskId: number }
  | null;

export default function TasksPage() {
  const taskResponse = tasksRouteApi.useLoaderData();
  const search = tasksRouteApi.useSearch();
  const navigate = tasksRouteApi.useNavigate();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [editor, setEditor] = useState<EditorState>(null);

  const sortMode: TaskSortMode = search.sort ?? "date";
  const view: TaskView = search.view ?? "all";
  const showCompleted = search.completed ?? false;
  const layoutPref: TaskLayout = search.layout ?? "list";
  const layout: TaskLayout = isMobile ? "list" : layoutPref;

  const setLayout = useCallback(
    (l: TaskLayout) =>
      navigate({
        search: (prev) => ({ ...prev, layout: l === "list" ? undefined : l }),
      }),
    [navigate],
  );

  const setShowCompleted = useCallback(
    (v: boolean) =>
      navigate({ search: (prev) => ({ ...prev, completed: v || undefined }) }),
    [navigate],
  );

  const pomodoro = usePomodoro();

  const tasks = taskResponse.data;

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => (showCompleted ? true : task.status !== "done")),
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

  const closeEditor = useCallback(() => setEditor(null), []);
  const invalidateTasks = () => {
    void router.invalidate();
  };

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      closeEditor();
      invalidateTasks();
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
      invalidateTasks();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) =>
      updateTask(taskId, { status }),
    onSuccess: invalidateTasks,
  });

  const priorityMutation = useMutation({
    mutationFn: ({
      taskId,
      priority,
    }: {
      taskId: number;
      priority: TaskPriority;
    }) => updateTask(taskId, { priority }),
    onSuccess: invalidateTasks,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      closeEditor();
      invalidateTasks();
    },
  });

  const setView = useCallback(
    (v: TaskView) => {
      navigate({
        search: (prev) => ({
          ...prev,
          view: v === "all" ? undefined : v,
        }),
      });
    },
    [navigate],
  );

  const handleStatusChange = useCallback(
    (taskId: number, status: TaskStatus) => {
      statusMutation.mutate({ taskId, status });
    },
    [statusMutation],
  );

  const handlePriorityChange = useCallback(
    (taskId: number, priority: TaskPriority) => {
      priorityMutation.mutate({ taskId, priority });
    },
    [priorityMutation],
  );

  const handleToggleEdit = useCallback((taskId: number) => {
    setEditor((current) =>
      current?.mode === "edit" && current.taskId === taskId
        ? null
        : { mode: "edit", taskId },
    );
  }, []);

  const handleDeleteTask = useCallback(
    (taskId: number) => {
      deleteTaskMutation.mutate(taskId);
    },
    [deleteTaskMutation],
  );

  const handleSubmitEdit = useCallback(
    (taskId: number, value: TaskEditorSubmitValue) => {
      updateTaskMutation.mutate({ taskId, input: value });
    },
    [updateTaskMutation],
  );

  const taskActions = useMemo(
    () => ({
      isUpdateSubmitting: updateTaskMutation.isPending,
      onStatusChange: handleStatusChange,
      onPriorityChange: handlePriorityChange,
      onToggleEdit: handleToggleEdit,
      onCancelEdit: closeEditor,
      onDelete: handleDeleteTask,
      onSubmitEdit: handleSubmitEdit,
    }),
    [
      updateTaskMutation.isPending,
      handleStatusChange,
      handlePriorityChange,
      handleToggleEdit,
      closeEditor,
      handleDeleteTask,
      handleSubmitEdit,
    ],
  );

  return (
    <TaskActionsProvider value={taskActions}>
      <div className="mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{VIEW_LABELS[view]}</h2>
          <div className="flex items-center gap-2">
            <ButtonGroup>
              {(["all", "today", "upcoming"] as TaskView[]).map((v) => (
                <Button
                  key={v}
                  variant={view === v ? "default" : "outline"}
                  onClick={() => setView(v)}
                >
                  {VIEW_LABELS[v]}
                </Button>
              ))}
            </ButtonGroup>
            {!isMobile && (
              <ButtonGroup>
                <Button
                  variant={layout === "list" ? "default" : "outline"}
                  onClick={() => setLayout("list")}
                >
                  <ListIcon />
                </Button>
                <Button
                  variant={layout === "board" ? "default" : "outline"}
                  onClick={() => setLayout("board")}
                >
                  <KanbanIcon />
                </Button>
              </ButtonGroup>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {layout === "list" && (
            <>
              <ButtonGroup>
                <Button
                  variant={sortMode === "date" ? "default" : "outline"}
                  onClick={() =>
                    navigate({ search: (prev) => ({ ...prev, sort: "date" }) })
                  }
                >
                  Date
                </Button>
                <Button
                  variant={sortMode === "priority" ? "default" : "outline"}
                  onClick={() =>
                    navigate({
                      search: (prev) => ({ ...prev, sort: "priority" }),
                    })
                  }
                >
                  Priority
                </Button>
              </ButtonGroup>

              <div className="flex items-center justify-center gap-2">
                <Checkbox
                  checked={showCompleted}
                  onCheckedChange={(v) => setShowCompleted(v === true)}
                />
                <Label className="text-primary">Show completed</Label>
              </div>
            </>
          )}

          <div className="ml-auto flex gap-2">
            <Button
              onClick={() =>
                setEditor({
                  mode: "create",
                  dueAt: view === "today" ? getDefaultCreateDueAt() : null,
                })
              }
            >
              Add task
            </Button>
            <Button variant="outline" onClick={() => pomodoro.start()}>
              {pomodoro.state.status !== "idle" ? "Focusing..." : "Focus"}
            </Button>
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
                dueTime: value.dueTime ?? undefined,
              })
            }
          />
        ) : null}

        {layout === "board" ? (
          <TaskBoard
            tasks={tasks}
            onEdit={(taskId) => setEditor({ mode: "edit", taskId })}
            onPomodoro={(taskId, title) => pomodoro.start(taskId, title)}
          />
        ) : (
          <TaskListView
            sections={sections}
            totalTasks={tasks.length}
            editor={editor}
            isMobile={isMobile}
            showCompleted={showCompleted}
            view={view}
            onSetEditor={setEditor}
            onCreateFromEmpty={() =>
              setEditor({
                mode: "create",
                dueAt: getDefaultCreateDueAt(),
              })
            }
          />
        )}

        <Sheet
          open={(isMobile || layout === "board") && editor !== null}
          onOpenChange={closeEditor}
        >
          <SheetContent showCloseButton={false} side="bottom" className="pb-4">
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
                    dueTime: value.dueTime ?? undefined,
                  })
                }
              />
            ) : editingTask ? (
              <TaskEditor
                key={editingTask.id}
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

        <PomodoroPill
          state={pomodoro.state}
          onStart={() => pomodoro.start()}
          onPause={pomodoro.pause}
          onStop={pomodoro.stop}
          onSkip={pomodoro.skip}
        />
      </div>
    </TaskActionsProvider>
  );
}
