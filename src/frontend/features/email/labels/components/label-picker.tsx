import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PlusIcon, TagIcon } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { applyLabel, createLabel, removeLabel } from "../mutations";
import { isInternalLabelName } from "../internal-labels";
import { fetchLabels } from "../queries";
import type { Label } from "../types";

type LabelPickerProps = {
  mailboxId: number;
  emailIds: string[];
  appliedLabelIds: string[];
  trigger?: React.ReactNode;
  onDone?: () => void;
};

type ToggleVars = { labelId: string; apply: boolean };

export function LabelPicker({
  mailboxId,
  emailIds,
  appliedLabelIds,
  trigger,
  onDone,
}: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(
    new Set(appliedLabelIds),
  );

  const labelsQuery = useQuery({
    queryKey: labelQueryKeys.list(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
  });

  const toggleMutation = useMutation<
    void,
    Error,
    ToggleVars,
    { previous: Set<string> }
  >({
    mutationFn: ({ labelId, apply }) =>
      apply
        ? applyLabel(emailIds, labelId, mailboxId)
        : removeLabel(emailIds, labelId, mailboxId),
    onMutate: ({ labelId, apply }) => {
      const previous = optimisticIds;
      const next = new Set(previous);
      if (apply) next.add(labelId);
      else next.delete(labelId);
      setOptimisticIds(next);
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context) setOptimisticIds(context.previous);
      toast.error(error.message || "Failed to update label");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const label = await createLabel(mailboxId, { name });
      await applyLabel(emailIds, label.gmailId, mailboxId);
      return label;
    },
    onSuccess: (label) => {
      setOptimisticIds((prev) => new Set(prev).add(label.gmailId));
      setSearch("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create label");
    },
  });

  const labels = (labelsQuery.data ?? []).filter(
    (label) => !isInternalLabelName(label.name),
  );
  const filtered = search
    ? labels.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : labels;

  function toggleLabel(label: Label) {
    const apply = !optimisticIds.has(label.gmailId);
    toggleMutation.mutate({ labelId: label.gmailId, apply });
  }

  function handleCreate() {
    const name = search.trim();
    if (!name || createMutation.isPending) return;
    createMutation.mutate(name);
  }

  const exactMatch = labels.some(
    (l) => l.name.toLowerCase() === search.toLowerCase(),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setOptimisticIds(new Set(appliedLabelIds));
        } else {
          setSearch("");
          onDone?.();
        }
      }}
    >
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            <TagIcon className="size-4" />
            <span>Label</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0 gap-0" align="start">
        <div className="border-b">
          <Input
            placeholder="Search or create label…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim() && !exactMatch) {
                e.preventDefault();
                handleCreate();
              }
            }}
            className="h-7 text-xs border-none ring-0 focus-visible:outline-none"
            autoFocus
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.map((label) => {
            const isApplied = optimisticIds.has(label.gmailId);
            return (
              <button
                key={label.gmailId}
                type="button"
                onClick={() => toggleLabel(label)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={isApplied}
                  tabIndex={-1}
                  className="pointer-events-none"
                />
                <span className="flex-1 truncate text-left">{label.name}</span>
              </button>
            );
          })}
          {search.trim() && !exactMatch && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex w-full items-center gap-1 rounded-sm px-2 py-2 text-xs hover:bg-muted"
            >
              <PlusIcon className="size-3" />
              <span>Create "{search.trim()}"</span>
            </button>
          )}
          {filtered.length === 0 && !search.trim() && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No labels yet
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
