import { Button } from "@/components/ui/button";
import {
  FilterEditor,
  type EditingFilter,
} from "@/features/filters/components/filter-editor";
import {
  createFilter,
  deleteFilter,
  fetchFilters,
  testFilter,
  updateFilter,
} from "@/features/filters/queries";
import type { EmailFilter, FilterTestResult } from "@/features/filters/types";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export default function FiltersPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingFilter | null>(null);
  const [testResult, setTestResult] = useState<FilterTestResult | null>(null);

  const { data: filters = [], isPending } = useQuery({
    queryKey: ["filters"],
    queryFn: fetchFilters,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["filters"] });

  const createMutation = useMutation({
    mutationFn: createFilter,
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setTestResult(null);
      toast.success("Filter created");
    },
    onError: () => toast.error("Failed to create filter"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...rest }: { id: number } & Parameters<typeof updateFilter>[1]) =>
      updateFilter(id, rest),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setTestResult(null);
      toast.success("Filter updated");
    },
    onError: () => toast.error("Failed to update filter"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFilter,
    onSuccess: () => {
      invalidate();
      toast.success("Filter deleted");
    },
    onError: () => toast.error("Failed to delete filter"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      updateFilter(id, { enabled }),
    onSuccess: invalidate,
  });

  const testMutation = useMutation({
    mutationFn: testFilter,
    onSuccess: (data) => setTestResult(data),
    onError: () => toast.error("Test failed"),
  });

  const startNew = useCallback(() => {
    setEditing({
      id: null,
      name: "",
      conditions: [{ field: "from", operator: "contains", value: "" }],
      actions: {},
      enabled: true,
    });
    setTestResult(null);
  }, []);

  const startEdit = useCallback((filter: EmailFilter) => {
    setEditing({
      id: filter.id,
      name: filter.name,
      conditions: [...filter.conditions],
      actions: { ...filter.actions },
      enabled: filter.enabled,
    });
    setTestResult(null);
  }, []);

  const save = useCallback(() => {
    if (!editing) return;
    const validConditions = editing.conditions.filter((c) => c.value.trim());
    if (validConditions.length === 0) {
      toast.error("Add at least one condition with a value");
      return;
    }
    if (!editing.name.trim()) {
      toast.error("Filter name is required");
      return;
    }

    const payload = {
      name: editing.name,
      conditions: validConditions,
      actions: editing.actions,
      enabled: editing.enabled,
    };

    if (editing.id) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [editing, createMutation, updateMutation]);

  const runTest = useCallback(() => {
    if (!editing) return;
    const validConditions = editing.conditions.filter((c) => c.value.trim());
    if (validConditions.length === 0) return;
    testMutation.mutate({ conditions: validConditions, actions: editing.actions });
  }, [editing, testMutation]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-medium tracking-tight">Email Filters</h1>
        <Button size="sm" onClick={startNew} disabled={editing !== null}>
          <PlusIcon className="mr-1.5 size-4" />
          New filter
        </Button>
      </header>

      {editing && (
        <FilterEditor
          editing={editing}
          onChange={setEditing}
          onSave={save}
          onCancel={() => {
            setEditing(null);
            setTestResult(null);
          }}
          onTest={runTest}
          isSaving={createMutation.isPending || updateMutation.isPending}
          isTesting={testMutation.isPending}
          testResult={testResult}
        />
      )}

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading filters...</p>
      ) : filters.length === 0 && !editing ? (
        <p className="rounded-md border border-border/60 p-4 text-center text-sm text-muted-foreground">
          No filters yet. Create one to automatically sort incoming emails.
        </p>
      ) : (
        <div className="space-y-2">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{filter.name}</span>
                  {!filter.enabled && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {filter.conditions
                    .map((c) => `${c.field} ${c.operator} "${c.value}"`)
                    .join(" AND ")}
                  {" → "}
                  {Object.entries(filter.actions)
                    .filter(([, v]) => v)
                    .map(([k, v]) =>
                      k === "applyAiLabel" ? `label:${v}` : k,
                    )
                    .join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    toggleMutation.mutate({
                      id: filter.id,
                      enabled: !filter.enabled,
                    })
                  }
                >
                  {filter.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => startEdit(filter)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  onClick={() => deleteMutation.mutate(filter.id)}
                >
                  <TrashIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
