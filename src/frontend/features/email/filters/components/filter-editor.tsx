import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FilterActions } from "@/features/email/filters/types";
import { CheckIcon, XIcon } from "@phosphor-icons/react";

const ACTION_KEYS = ["archive", "markRead", "star", "trash"] as const;

const ACTION_LABELS: Record<string, string> = {
  archive: "Done",
  markRead: "Mark read",
  star: "Star",
  trash: "Trash",
};

export type EditingFilter = {
  id: number | null;
  name: string;
  description: string;
  actions: FilterActions;
  enabled: boolean;
};

export function FilterEditor({
  editing,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: {
  editing: EditingFilter;
  onChange: (filter: EditingFilter) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const toggleAction = (key: keyof FilterActions) => {
    const current = editing.actions[key];
    onChange({
      ...editing,
      actions: { ...editing.actions, [key]: current ? undefined : true },
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <Input
        value={editing.name}
        onChange={(e) => onChange({ ...editing, name: e.target.value })}
        placeholder="Filter name"
        className="max-w-sm text-sm"
      />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Match emails where
        </p>
        <textarea
          value={editing.description}
          onChange={(e) =>
            onChange({ ...editing, description: e.target.value })
          }
          placeholder='e.g. "Emails from LinkedIn that are suggestions, connection requests, or job alerts"'
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Then
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ACTION_KEYS.map((key) => {
            const active = Boolean(editing.actions[key]);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleAction(key)}
                className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs transition-colors ${
                  active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {ACTION_LABELS[key]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 pt-3">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={onSave}
          disabled={isSaving}
        >
          <CheckIcon className="mr-1 size-3" />
          {isSaving ? "Saving..." : editing.id ? "Update" : "Create"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          <XIcon className="mr-1 size-3" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
