import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { GMAIL_LABEL_COLORS, type Label } from "../types";
import { updateLabel, deleteLabel } from "../mutations";

type LabelEditorProps = {
  label: Label;
  mailboxId: number;
  trigger: React.ReactNode;
  onDeleted?: () => void;
};

export function LabelEditor({ label, mailboxId, trigger, onDeleted }: LabelEditorProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(label.name);
  const [bg, setBg] = useState(label.backgroundColor ?? "#999999");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const color = GMAIL_LABEL_COLORS.find((c) => c.bg === bg);
      await updateLabel(label.gmailId, mailboxId, {
        name: name.trim(),
        backgroundColor: bg,
        textColor: color?.text ?? "#000000",
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteLabel(label.gmailId, mailboxId);
      setOpen(false);
      onDeleted?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setName(label.name);
          setBg(label.backgroundColor ?? "#999999");
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 space-y-3 p-3" align="start">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Label name"
          className="h-8 text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
        <div className="grid grid-cols-7 gap-1.5">
          {GMAIL_LABEL_COLORS.slice(0, 21).map((color) => (
            <button
              key={color.bg}
              type="button"
              onClick={() => setBg(color.bg)}
              className={`size-5 rounded-full border-2 transition-transform hover:scale-110 ${bg === color.bg ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: color.bg }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={saving}
            className="text-destructive hover:text-destructive"
          >
            <TrashIcon className="size-4" />
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
