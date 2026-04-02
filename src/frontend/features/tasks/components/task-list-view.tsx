import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { TaskRow } from "@/features/tasks/components/task-row";
import type { TaskView } from "@/features/tasks/types";
import {
  fromTaskDateInputValue,
  type TaskSection,
} from "@/features/tasks/utils";
import { PlusIcon } from "@phosphor-icons/react";

type EditorState =
  | { mode: "create"; dueAt: number | null }
  | { mode: "edit"; taskId: number }
  | null;

type TaskListViewProps = {
  sections: TaskSection[];
  totalTasks: number;
  editor: EditorState;
  isMobile: boolean;
  showCompleted: boolean;
  view: TaskView;
  onSetEditor: (editor: EditorState) => void;
  onCreateFromEmpty: () => void;
};

export function TaskListView({
  sections,
  totalTasks,
  editor,
  isMobile,
  showCompleted,
  view,
  onSetEditor,
  onCreateFromEmpty,
}: TaskListViewProps) {
  if (sections.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Empty className="min-h-0 flex-1 border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>
              {totalTasks > 0 && !showCompleted
                ? "No open tasks"
                : view === "today"
                  ? "Nothing due today"
                  : "No tasks yet"}
            </EmptyTitle>
            <EmptyDescription className="text-xs">
              {totalTasks > 0 && !showCompleted
                ? "You're all caught up."
                : "Add a task to get started."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onCreateFromEmpty}>Add task</Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.key} className="space-y-1">
          <div className="flex items-center justify-between py-1">
            <h2 className="text-xs font-medium text-muted-foreground">
              {section.title}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={() =>
                onSetEditor({
                  mode: "create",
                  dueAt:
                    section.key === "no-date"
                      ? null
                      : fromTaskDateInputValue(section.key),
                })
              }
            >
              <PlusIcon className="mr-1 size-3" />
              Add
            </Button>
          </div>

          <div className="space-y-0.5">
            {section.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isEditing={
                  !isMobile &&
                  editor?.mode === "edit" &&
                  editor.taskId === task.id
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
