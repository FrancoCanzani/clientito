import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  FilterActions,
  FilterCondition,
  FilterConditionField,
  FilterConditionOperator,
  FilterTestResult,
} from "@/features/filters/types";
import {
  FloppyDiskIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";

const FIELD_OPTIONS: { value: FilterConditionField; label: string }[] = [
  { value: "from", label: "From" },
  { value: "to", label: "To" },
  { value: "subject", label: "Subject" },
  { value: "aiLabel", label: "AI Label" },
];

const OPERATOR_OPTIONS: { value: FilterConditionOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
];

const AI_LABEL_OPTIONS = [
  "important",
  "later",
  "newsletter",
  "transactional",
  "notification",
] as const;

export type EditingFilter = {
  id: number | null;
  name: string;
  conditions: FilterCondition[];
  actions: FilterActions;
  enabled: boolean;
};

export function FilterEditor({
  editing,
  onChange,
  onSave,
  onCancel,
  onTest,
  isSaving,
  isTesting,
  testResult,
}: {
  editing: EditingFilter;
  onChange: (filter: EditingFilter) => void;
  onSave: () => void;
  onCancel: () => void;
  onTest: () => void;
  isSaving: boolean;
  isTesting: boolean;
  testResult: FilterTestResult | null;
}) {
  const updateCondition = (idx: number, patch: Partial<FilterCondition>) => {
    const conditions = [...editing.conditions];
    conditions[idx] = { ...conditions[idx], ...patch };
    onChange({ ...editing, conditions });
  };

  const removeCondition = (idx: number) => {
    onChange({
      ...editing,
      conditions: editing.conditions.filter((_, i) => i !== idx),
    });
  };

  const updateAction = (patch: Partial<FilterActions>) => {
    onChange({ ...editing, actions: { ...editing.actions, ...patch } });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <Input
        value={editing.name}
        onChange={(e) => onChange({ ...editing, name: e.target.value })}
        placeholder="Filter name"
        className="max-w-xs"
      />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Conditions (all must match)
        </p>
        {editing.conditions.map((condition, idx) => (
          <div key={condition.field + idx} className="flex items-center gap-2">
            <select
              value={condition.field}
              onChange={(e) =>
                updateCondition(idx, {
                  field: e.target.value as FilterConditionField,
                })
              }
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {FIELD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={condition.operator}
              onChange={(e) =>
                updateCondition(idx, {
                  operator: e.target.value as FilterConditionOperator,
                })
              }
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {OPERATOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Input
              value={condition.value}
              onChange={(e) =>
                updateCondition(idx, { value: e.target.value })
              }
              placeholder="Value"
              className="max-w-xs"
            />
            {editing.conditions.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => removeCondition(idx)}
              >
                <TrashIcon className="size-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              ...editing,
              conditions: [
                ...editing.conditions,
                { field: "from", operator: "contains", value: "" },
              ],
            })
          }
        >
          <PlusIcon className="mr-1 size-3.5" />
          Add condition
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Actions
        </p>
        <div className="flex flex-wrap gap-3">
          {(["archive", "markRead", "star", "trash"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.actions[key] ?? false}
                onChange={(e) =>
                  updateAction({ [key]: e.target.checked || undefined })
                }
              />
              {key === "markRead" ? "Mark read" : key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
          <div className="flex items-center gap-2 text-sm">
            <span>AI label:</span>
            <select
              value={editing.actions.applyAiLabel ?? ""}
              onChange={(e) =>
                updateAction({
                  applyAiLabel:
                    (e.target.value as FilterActions["applyAiLabel"]) ||
                    undefined,
                })
              }
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">None</option>
              {AI_LABEL_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          <FloppyDiskIcon className="mr-1.5 size-4" />
          {isSaving ? "Saving..." : editing.id ? "Update" : "Create"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={isTesting}
        >
          <PlayIcon className="mr-1.5 size-4" />
          {isTesting ? "Testing..." : "Test"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {testResult && (
        <div className="rounded-md border border-border/60 p-3 text-sm">
          <p className="text-muted-foreground">
            {testResult.matchCount} of {testResult.totalTested} recent emails
            matched
          </p>
          {testResult.samples.length > 0 && (
            <ul className="mt-2 space-y-1">
              {testResult.samples.map((s) => (
                <li
                  key={s.id}
                  className="truncate text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {s.from}
                  </span>{" "}
                  — {s.subject ?? "(no subject)"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
