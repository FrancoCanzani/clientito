import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckIcon, PlusIcon, TagIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchLabels } from "../queries";
import { createLabel, applyLabel, removeLabel } from "../mutations";
import type { Label } from "../types";

type LabelPickerProps = {
  mailboxId: number;
  emailIds: string[];
  appliedLabelIds: string[];
  trigger?: React.ReactNode;
  onDone?: () => void;
};

export function LabelPicker({
  mailboxId,
  emailIds,
  appliedLabelIds,
  trigger,
  onDone,
}: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const labelsQuery = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
  });

  const labels = labelsQuery.data ?? [];
  const filtered = search
    ? labels.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : labels;

  const appliedSet = new Set(appliedLabelIds);

  async function toggleLabel(label: Label) {
    if (appliedSet.has(label.gmailId)) {
      await removeLabel(emailIds, label.gmailId, mailboxId);
    } else {
      await applyLabel(emailIds, label.gmailId, mailboxId);
    }
  }

  async function handleCreate() {
    if (!search.trim()) return;
    setCreating(true);
    try {
      const label = await createLabel(mailboxId, { name: search.trim() });
      await applyLabel(emailIds, label.gmailId, mailboxId);
      setSearch("");
    } finally {
      setCreating(false);
    }
  }

  const exactMatch = labels.some((l) => l.name.toLowerCase() === search.toLowerCase());

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
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
      <PopoverContent className="w-56 p-0" align="start">
        <div className="border-b p-2">
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
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-48 overflow-y-auto p-1">
          {filtered.map((label) => {
            const isApplied = appliedSet.has(label.gmailId);
            return (
              <button
                key={label.gmailId}
                type="button"
                onClick={() => toggleLabel(label)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: label.backgroundColor ?? "#999" }}
                />
                <span className="flex-1 truncate text-left">{label.name}</span>
                {isApplied && <CheckIcon className="size-3.5 text-primary" />}
              </button>
            );
          })}
          {search.trim() && !exactMatch && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <PlusIcon className="size-3.5" />
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
