import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import {
  FilterEditor,
  type EditingFilter,
} from "@/features/filters/components/filter-editor";
import {
  createFilter,
  deleteFilter,
  fetchFilters,
  generateFilter,
  updateFilter,
} from "@/features/filters/queries";
import type { EmailFilter } from "@/features/filters/types";
import {
  ArrowRightIcon,
  PencilSimpleIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

const NOISE_FILTER_TEMPLATES = [
  {
    name: "Archive newsletters",
    description:
      "Newsletters, weekly roundups, digest emails, and editorial content from subscriptions",
    actions: { archive: true, markRead: true } as const,
  },
  {
    name: "Archive marketing",
    description:
      "Promotional emails, sales, discounts, flash deals, product offers, and company marketing campaigns",
    actions: { archive: true, markRead: true } as const,
  },
  {
    name: "Archive notifications",
    description:
      "Automated alerts, app notifications, product updates, social media summaries, and system-generated informational emails",
    actions: { archive: true, markRead: true } as const,
  },
  {
    name: "Archive transactional",
    description:
      "Receipts, order confirmations, shipping notifications, password resets, and verification codes",
    actions: { archive: true, markRead: true } as const,
  },
];

const ACTION_LABELS: Record<string, string> = {
  archive: "Archive",
  markRead: "Mark read",
  star: "Star",
  trash: "Trash",
};

const FILTER_SKELETON_KEYS = ["filter-a", "filter-b", "filter-c"] as const;

function formatActions(actions: Record<string, unknown>) {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(actions)) {
    if (!value) continue;
    if (key === "applyCategory") {
      parts.push(`Label as ${value}`);
    } else if (ACTION_LABELS[key]) {
      parts.push(ACTION_LABELS[key]);
    }
  }
  return parts;
}

export default function FiltersPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingFilter | null>(null);
  const [prompt, setPrompt] = useState("");

  const { data: filters = [], isPending } = useQuery({
    queryKey: ["filters"],
    queryFn: fetchFilters,
  });
  const availableTemplates = useMemo(() => {
    const existingNames = new Set(filters.map((filter) => filter.name));
    return NOISE_FILTER_TEMPLATES.filter(
      (template) => !existingNames.has(template.name),
    );
  }, [filters]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["filters"] });

  const generateMutation = useMutation({
    mutationFn: generateFilter,
    onSuccess: (data) => {
      setEditing({
        id: null,
        name: data.name,
        description: data.description,
        actions: data.actions,
        enabled: true,
      });
      setPrompt("");
    },
    onError: () => toast.error("Failed to generate filter"),
  });

  const createMutation = useMutation({
    mutationFn: createFilter,
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Filter created");
    },
    onError: () => toast.error("Failed to create filter"),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...rest
    }: { id: number } & Parameters<typeof updateFilter>[1]) =>
      updateFilter(id, rest),
    onSuccess: () => {
      invalidate();
      setEditing(null);
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

  const startEdit = useCallback((filter: EmailFilter) => {
    setEditing({
      id: filter.id,
      name: filter.name,
      description: filter.description,
      actions: { ...filter.actions },
      enabled: filter.enabled,
    });
  }, []);

  const save = useCallback(() => {
    if (!editing) return;
    if (!editing.description.trim()) {
      toast.error("Filter description is required");
      return;
    }
    if (!editing.name.trim()) {
      toast.error("Filter name is required");
      return;
    }

    const payload = {
      name: editing.name,
      description: editing.description,
      actions: editing.actions,
      enabled: editing.enabled,
    };

    if (editing.id) {
      updateMutation.mutate({ id: editing.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [editing, createMutation, updateMutation]);

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    generateMutation.mutate(trimmed);
  };

  return (
    <div className="flex min-h-0 w-full max-w-2xl min-w-0 flex-1 flex-col gap-8 py-2">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>Filters</span>
          </div>
        }
      />

      <form onSubmit={handlePromptSubmit} className="relative">
        <SparkleIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='Describe a filter... e.g. "Archive LinkedIn suggestions"'
          className="pl-9 pr-20"
          disabled={generateMutation.isPending}
        />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className="absolute right-1 top-1/2 h-7 -translate-y-1/2 text-xs"
          disabled={!prompt.trim() || generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            "Generating..."
          ) : (
            <>
              Create
              <ArrowRightIcon className="ml-1 size-3" />
            </>
          )}
        </Button>
      </form>

      {!isPending && availableTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Suggested
          </p>
          <div className="flex flex-wrap gap-2">
            {availableTemplates.map((template) => (
              <Button
                key={template.name}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(template)}
              >
                <PlusIcon className="mr-1 size-3" />
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <FilterEditor
          editing={editing}
          onChange={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {isPending ? (
        <div className="space-y-3">
          {FILTER_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      ) : filters.length === 0 && !editing ? (
        <Empty className="min-h-0 flex-1 border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No filters yet</EmptyTitle>
            <EmptyDescription>
              Describe what you want above or create one manually.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing({
                  id: null,
                  name: "",
                  description: "",
                  actions: {},
                  enabled: true,
                });
              }}
            >
              Create manually
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filters.map((filter) => (
            <div
              key={filter.id}
              className={`group rounded-lg border border-border px-4 py-3 transition-colors ${
                !filter.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{filter.name}</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filter.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ArrowRightIcon className="size-3 text-muted-foreground" />
                    {formatActions(filter.actions).map((action) => (
                      <Badge
                        key={action}
                        variant="outline"
                        className="font-normal"
                      >
                        {action}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => startEdit(filter)}
                    >
                      <PencilSimpleIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(filter.id)}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                  <Switch
                    size="sm"
                    checked={filter.enabled}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: filter.id, enabled: checked })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
