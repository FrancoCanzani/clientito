import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchLabels } from "@/features/email/labels/queries";
import { createLabel, updateLabel, deleteLabel } from "@/features/email/labels/mutations";
import { GMAIL_LABEL_COLORS, type Label } from "@/features/email/labels/types";
import { PencilSimpleIcon, TrashIcon, PlusIcon, CheckIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

type LabelsSettingsSectionProps = {
  mailboxId: number;
};

type EditingState = {
  gmailId: string;
  name: string;
  bg: string;
};

export function LabelsSettingsSection({ mailboxId }: LabelsSettingsSectionProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBg, setNewBg] = useState<string>(GMAIL_LABEL_COLORS[10].bg);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);

  const labelsQuery = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const labels = labelsQuery.data ?? [];

  async function handleCreate() {
    const name = newName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const color = GMAIL_LABEL_COLORS.find((c) => c.bg === newBg);
      await createLabel(mailboxId, {
        name,
        backgroundColor: newBg,
        textColor: color?.text ?? "#000000",
      });
      setNewName("");
      setNewBg(GMAIL_LABEL_COLORS[10].bg);
      setCreating(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!editing || !editing.name.trim() || saving) return;
    setSaving(true);
    try {
      const color = GMAIL_LABEL_COLORS.find((c) => c.bg === editing.bg);
      await updateLabel(editing.gmailId, mailboxId, {
        name: editing.name.trim(),
        backgroundColor: editing.bg,
        textColor: color?.text ?? "#000000",
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(label: Label) {
    setSaving(true);
    try {
      await deleteLabel(label.gmailId, mailboxId);
    } finally {
      setSaving(false);
    }
  }

  function startEditing(label: Label) {
    setEditing({
      gmailId: label.gmailId,
      name: label.name,
      bg: label.backgroundColor ?? "#999999",
    });
  }

  return (
    <section id="labels" className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Labels
        </h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          Manage your email labels.
        </p>
      </div>

      <div className="border-t border-border/60">
        {labels.length === 0 && !creating && (
          <p className="py-3 text-sm text-muted-foreground">
            No labels yet.
          </p>
        )}

        {labels.map((label) => {
          const isEditing = editing?.gmailId === label.gmailId;

          return (
            <div key={label.gmailId}>
              <div className="flex items-center gap-3 py-2.5">
                {isEditing ? (
                  <>
                    <ColorDot bg={editing.bg} />
                    <Input
                      value={editing.name}
                      onChange={(e) =>
                        setEditing({ ...editing, name: e.target.value })
                      }
                      className="h-7 flex-1 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <ColorPicker
                      value={editing.bg}
                      onChange={(bg) => setEditing({ ...editing, bg })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={handleSave}
                      disabled={saving || !editing.name.trim()}
                    >
                      <CheckIcon className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setEditing(null)}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <ColorDot bg={label.backgroundColor ?? "#999"} />
                    <span className="flex-1 truncate text-sm font-medium">
                      {label.name}
                    </span>
                    <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => startEditing(label)}
                        >
                          <PencilSimpleIcon className="size-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              disabled={saving}
                            >
                              <TrashIcon className="size-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete label</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{label.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(label)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                  </>
                )}
              </div>
              <div className="border-t border-border/60" />
            </div>
          );
        })}

        {creating ? (
          <div className="space-y-3 py-3">
            <div className="flex items-center gap-3">
              <ColorDot bg={newBg} />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Label name"
                className="h-7 flex-1 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
              />
              <ColorPicker value={newBg} onChange={setNewBg} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
              >
                Create
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating(true)}
            >
              <PlusIcon className="mr-1.5 size-3.5" />
              Create label
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function ColorDot({ bg }: { bg: string }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: `${bg}30` }}
    >
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: bg }}
      />
    </span>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (bg: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="size-6 shrink-0 rounded-full border-2 border-border transition-transform hover:scale-110"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end" sideOffset={8}>
        <div className="grid grid-cols-7 gap-2">
          {GMAIL_LABEL_COLORS.slice(0, 21).map((color) => (
            <button
              key={color.bg}
              type="button"
              onClick={() => {
                onChange(color.bg);
                setOpen(false);
              }}
              className={`size-6 rounded-full border-2 transition-transform hover:scale-110 ${value === color.bg ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: color.bg }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
