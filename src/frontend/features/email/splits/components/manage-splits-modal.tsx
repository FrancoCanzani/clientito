import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import type { SplitViewRow } from "@/db/schema";
import {
  createSplitView,
  setSplitViewVisible,
  setSystemSplitVisible,
  useSplitViews,
  type SplitViewCreateInput,
} from "@/features/email/splits/queries";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useState } from "react";

type View = "list" | "create";

export function ManageSplitsModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const [view, setView] = useState<View>("list");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setView("list");
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-start gap-2 p-4">
          {view === "create" ? (
            <IconButton
              label="Back"
              variant="ghost"
              size="icon-sm"
              onClick={() => setView("list")}
              className="-ml-1"
            >
              <ArrowLeftIcon className="size-4" />
            </IconButton>
          ) : null}
          <div className="flex-1 min-w-0 space-y-1">
            <DialogTitle>
              {view === "list" ? "Split inbox" : "Create new split"}
            </DialogTitle>
            <DialogDescription>
              {view === "list"
                ? "Toggle which splits appear as tabs in your inbox."
                : "Define deterministic rules for this split."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="border-t border-border/60" />

        {view === "list" ? (
          <SplitListView onCreateClick={() => setView("create")} />
        ) : (
          <CreateSplitView
            onCancel={() => setView("list")}
            onCreated={(id) => {
              onCreated?.(id);
              setView("list");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SplitListView({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
  const systemDefs = [
    {
      systemKey: "important",
      name: "Important",
      description: "Emails Gmail marks as important.",
    },
  ] as const;
  const { data: splits } = useSplitViews();
  const sorted = (splits ?? [])
    .slice()
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
  const systemByKey = new Map(
    sorted
      .filter((s): s is SplitViewRow & { systemKey: string } => s.isSystem && !!s.systemKey)
      .map((s) => [s.systemKey, s]),
  );
  const userSplits = sorted.filter((s) => !s.isSystem);

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div>
          <div className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            System
          </div>
          <ul className="divide-y">
            {systemDefs.map((def) => (
              <SystemSplitRow
                key={def.systemKey}
                def={def}
                row={systemByKey.get(def.systemKey) ?? null}
              />
            ))}
          </ul>
        </div>

        <div>
          <div className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Your splits
          </div>
          {userSplits.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              No splits yet. Create one to get started.
            </div>
          ) : (
            <ul className="divide-y">
              {userSplits.map((split) => (
                <SplitRow key={split.id} split={split} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-end border-t px-4 py-3">
        <Button size="sm" onClick={onCreateClick}>
          Create new split
        </Button>
      </footer>
    </>
  );
}

function SystemSplitRow({
  def,
  row,
}: {
  def: { systemKey: string; name: string; description: string };
  row: SplitViewRow | null;
}) {
  const [visible, setVisible] = useState(row?.visible ?? false);
  const [busy, setBusy] = useState(false);
  const displayVisible = row?.visible ?? visible;

  const toggle = async () => {
    if (busy) return;
    const next = !displayVisible;
    setVisible(next);
    setBusy(true);
    try {
      await setSystemSplitVisible(def.systemKey, next);
    } catch {
      setVisible(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{row?.name ?? def.name}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {row?.description ?? def.description}
        </p>
      </div>
      <Toggle checked={displayVisible} onChange={toggle} disabled={busy} />
    </li>
  );
}

function SplitRow({ split }: { split: SplitViewRow }) {
  const [visible, setVisible] = useState(split.visible);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    const next = !visible;
    setVisible(next);
    setBusy(true);
    try {
      await setSplitViewVisible(split.id, next);
    } catch {
      setVisible(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{split.name}</span>
          {split.isSystem && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              System
            </span>
          )}
        </div>
        {split.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {split.description}
          </p>
        )}
      </div>
      <Toggle checked={visible} onChange={toggle} disabled={busy} />
    </li>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
        checked
          ? "border-primary/60 bg-primary/80"
          : "border-border bg-muted",
        disabled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-block size-3.5 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

type FormState = {
  name: string;
  description: string;
  domains: string;
  senders: string;
  subjectContains: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  domains: "",
  senders: "",
  subjectContains: "",
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildInput(form: FormState): SplitViewCreateInput {
  const domains = splitList(form.domains);
  const senders = splitList(form.senders);
  const subjectContains = splitList(form.subjectContains);

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    rules: {
      domains: domains.length ? domains : undefined,
      senders: senders.length ? senders : undefined,
      subjectContains: subjectContains.length ? subjectContains : undefined,
    },
    visible: true,
  };
}

function CreateSplitView({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    form.name.trim().length > 0 &&
    (form.domains.trim().length > 0 ||
      form.senders.trim().length > 0 ||
      form.subjectContains.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createSplitView(buildInput(form));
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create split");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Field label="Name">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Invoices"
            autoFocus
            maxLength={64}
          />
        </Field>
        <Field label="Description" optional>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Receipts and bills"
            maxLength={240}
          />
        </Field>
        <div className="mt-1 mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Rules
        </div>

        <Field label="Domains" optional hint="Comma separated">
          <Input
            value={form.domains}
            onChange={(e) => setForm({ ...form, domains: e.target.value })}
            placeholder="stripe.com, vercel.com"
          />
        </Field>
        <Field label="Senders" optional>
          <Input
            value={form.senders}
            onChange={(e) => setForm({ ...form, senders: e.target.value })}
            placeholder="billing@, no-reply"
          />
        </Field>
        <Field label="Subject contains" optional>
          <Input
            value={form.subjectContains}
            onChange={(e) =>
              setForm({ ...form, subjectContains: e.target.value })
            }
            placeholder="invoice, receipt"
          />
        </Field>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? "Creating..." : "Create split"}
        </Button>
      </footer>
    </>
  );
}

function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        {label}
        {optional && (
          <span className="text-[10px] font-normal text-muted-foreground">
            optional
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
