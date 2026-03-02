import { Button } from "@/components/ui/button";
import { deleteTask, updateTask } from "@/features/tasks/api";
import type { Task } from "@/features/tasks/types";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { format } from "date-fns";
import { useMemo, useState } from "react";

const tasksRouteApi = getRouteApi("/_dashboard/tasks");

export default function TasksPage() {
  const { tasks: loadedTasks, people, companies } = tasksRouteApi.useLoaderData();
  const [tasks, setTasks] = useState<Task[]>(loadedTasks);
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const companiesById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

  const toggleTaskMutation = useMutation({
    mutationFn: async (task: Task) => updateTask(task.id, { done: !task.done }),
    onSuccess: (updatedTask) => {
      setTasks((prev) =>
        prev.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
      );
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => deleteTask(taskId),
    onSuccess: (_value, taskId) => {
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setExpandedTaskId((prev) => (prev === taskId ? null : prev));
    },
  });

  const visibleTasks = useMemo(
    () => tasks.filter((task) => (showCompleted ? true : !task.done)),
    [showCompleted, tasks],
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(event) => setShowCompleted(event.target.checked)}
          />
          Show completed
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const person = task.personId ? peopleById.get(task.personId) : null;
            const company = task.companyId ? companiesById.get(task.companyId) : null;

            return (
              <div key={task.id} className="border-b border-border/60 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedTaskId((prev) => (prev === task.id ? null : task.id))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTaskMutation.mutate(task)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}
                    >
                      {task.title}
                    </p>
                  </div>
                  {task.dueAt ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(task.dueAt), "PPP p")}
                    </span>
                  ) : null}
                </button>

                {isExpanded ? (
                  <div className="space-y-2 bg-muted/20 px-4 py-3 text-sm">
                    <p className="text-muted-foreground">
                      Linked person: {person?.name ?? person?.email ?? "None"}
                    </p>
                    <p className="text-muted-foreground">
                      Linked company: {company?.name ?? company?.domain ?? "None"}
                    </p>
                    <p className="text-muted-foreground">
                      Created: {format(new Date(task.createdAt), "PPP p")}
                    </p>
                    <div className="pt-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        disabled={deleteTaskMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No tasks to show.
          </p>
        )}
      </div>
    </div>
  );
}
