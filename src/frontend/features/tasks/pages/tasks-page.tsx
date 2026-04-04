import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TaskBoard } from "@/features/tasks/components/task-board";
import {
  TaskEditor,
  type TaskEditorSubmitValue,
} from "@/features/tasks/components/task-editor";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import { useTaskMutations } from "@/features/tasks/hooks/use-task-mutations";
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
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

const tasksRouteApi = getRouteApi("/_dashboard/$mailboxId/tasks");

type EditorState =
  | { mode: "create"; dueAt: number | null }
  | { mode: "edit"; taskId: number }
  | null;

export default function TasksPage() {
  const taskResponse = tasksRouteApi.useLoaderData();
  const search = tasksRouteApi.useSearch();
  const navigate = tasksRouteApi.useNavigate();
  const isMobile = useIsMobile();
  const [editor, setEditor] = useState<EditorState>(null);

  const sortMode: TaskSortMode = search.sort ?? "date";
  const view: TaskView = search.view ?? "all";
  const showCompleted = search.completed ?? false;
  const layoutPref: TaskLayout = search.layout ?? "list";
  const layout: TaskLayout = isMobile ? "list" : layoutPref;

  const setLayout = useCallback(
    (nextLayout: TaskLayout) =>
      navigate({
        search: (prev) => ({
          ...prev,
          layout: nextLayout === "list" ? undefined : nextLayout,
        }),
      }),
    [navigate],
  );

  const setShowCompleted = useCallback(
    (nextValue: boolean) =>
      navigate({
        search: (prev) => ({ ...prev, completed: nextValue || undefined }),
      }),
    [navigate],
  );

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

  const {
    createTaskMutation,
    updateTaskMutation,
    statusMutation,
    priorityMutation,
    deleteTaskMutation,
  } = useTaskMutations({ closeEditor });

  const setView = useCallback(
    (nextView: TaskView) => {
      navigate({
        search: (prev) => ({
          ...prev,
          view: nextView === "all" ? undefined : nextView,
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

  const taskRowActions = useMemo(
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
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-5">
      <PageHeader
        title={VIEW_LABELS[view]}
        actions={
          <Button
            size="sm"
            onClick={() =>
              setEditor({
                mode: "create",
                dueAt: view === "today" ? getDefaultCreateDueAt() : null,
              })
            }
          >
            Add task
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup>
          {(["all", "today", "upcoming"] as TaskView[]).map((taskView) => (
            <Button
              key={taskView}
              variant={view === taskView ? "default" : "outline"}
              onClick={() => setView(taskView)}
            >
              {VIEW_LABELS[taskView]}
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
                onCheckedChange={(value) => setShowCompleted(value === true)}
              />
              <Label className="text-primary">Show completed</Label>
            </div>
          </>
        )}
      </div>

      {!isMobile && editor?.mode === "create" && (
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
      )}

      {layout === "board" ? (
        <TaskBoard
          tasks={tasks}
          onEdit={(taskId) => setEditor({ mode: "edit", taskId })}
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
          taskRowActions={taskRowActions}
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
                })
              }
            />
          ) : (
            editingTask && (
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
            )
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
