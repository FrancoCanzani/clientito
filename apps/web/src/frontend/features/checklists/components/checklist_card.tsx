import { useState } from "react";
import { createChecklistItemFormSchema, createChecklistFormSchema, parseOptionalJsonRecord } from "@/features/checklists/checklist_schemas";
import type {
  ChecklistWithItems,
  CreateChecklistItemInput,
  UpdateChecklistInput,
} from "@/features/checklists/checklist_types";

interface ChecklistCardProps {
  checklist: ChecklistWithItems;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateConfig: (data: UpdateChecklistInput) => void;
  onCreateItem: (data: CreateChecklistItemInput) => void;
  onDeleteItem: (itemId: string) => void;
  busy: boolean;
}

export function ChecklistCard({
  checklist,
  onToggle,
  onDelete,
  onUpdateConfig,
  onCreateItem,
  onDeleteItem,
  busy,
}: ChecklistCardProps) {
  const configFormKey = `${checklist.id}-${checklist.title}-${checklist.description ?? ""}-${JSON.stringify(checklist.targetTraits ?? {})}`;
  const [configError, setConfigError] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [trackEvent, setTrackEvent] = useState("");

  return (
    <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">{checklist.title}</h3>
          {checklist.description && <p className="mt-0.5 text-xs text-[#475569]">{checklist.description}</p>}
          <p className="mt-1 text-[11px] text-[#64748b]">
            Status:{" "}
            <span className={checklist.isActive ? "text-emerald-700" : "text-[#64748b]"}>
              {checklist.isActive ? "active" : "inactive"}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggle}
            disabled={busy}
            className="rounded-md border border-[#d6e2f4] px-2.5 py-1 text-[11px] text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            {checklist.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      <form
        key={configFormKey}
        className="mt-3 space-y-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const editTitle = String(formData.get("editTitle") ?? "").trim();
          const editDescription = String(formData.get("editDescription") ?? "").trim();
          const targetTraitsJson = String(formData.get("targetTraitsJson") ?? "");

          const targetTraitsResult = parseOptionalJsonRecord(targetTraitsJson);
          if (!targetTraitsResult.ok) {
            setConfigError(targetTraitsResult.error);
            return;
          }

          const parsed = createChecklistFormSchema.safeParse({
            title: editTitle,
            description: editDescription || undefined,
            targetTraits: targetTraitsResult.data ?? undefined,
          });
          if (!parsed.success) {
            setConfigError(parsed.error.issues[0]?.message ?? "Invalid checklist config.");
            return;
          }

          onUpdateConfig(parsed.data);
          setConfigError(null);
        }}
      >
        <h4 className="text-xs font-semibold text-[#334155]">Checklist config</h4>
        <input
          name="editTitle"
          required
          defaultValue={checklist.title}
          className="block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
          placeholder="Checklist title"
        />
        <input
          name="editDescription"
          defaultValue={checklist.description ?? ""}
          className="block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
          placeholder="Checklist description"
        />
        <textarea
          name="targetTraitsJson"
          rows={4}
          defaultValue={checklist.targetTraits ? JSON.stringify(checklist.targetTraits, null, 2) : ""}
          className="block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 font-mono text-[11px]"
          placeholder='{"plan":"pro"}'
        />
        {configError && <p className="text-xs text-red-600">{configError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          Save config
        </button>
      </form>

      <div className="mt-4">
        <h4 className="text-xs font-semibold text-[#334155]">Items</h4>
        <ul className="mt-2 space-y-2">
          {checklist.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-md border border-[#e2e8f0] bg-[#fdfefe] p-2">
              <div>
                <p className="text-xs text-[#1e293b]">{item.title}</p>
                <p className="text-[11px] text-[#64748b]">{item.trackEvent}</p>
              </div>
              <button
                onClick={() => onDeleteItem(item.id)}
                disabled={busy}
                className="rounded border border-red-200 px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
          {checklist.items.length === 0 && <li className="text-xs text-[#64748b]">No checklist items.</li>}
        </ul>
      </div>

      <form
        className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();

          const parsed = createChecklistItemFormSchema.safeParse({
            title: itemTitle,
            trackEvent,
          });
          if (!parsed.success) {
            setItemError(parsed.error.issues[0]?.message ?? "Invalid checklist item.");
            return;
          }

          onCreateItem(parsed.data);
          setItemError(null);
          setItemTitle("");
          setTrackEvent("");
        }}
      >
        <input
          required
          type="text"
          placeholder="Item title"
          value={itemTitle}
          onChange={(event) => setItemTitle(event.target.value)}
          className="rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
        />
        <input
          required
          type="text"
          placeholder="Track event key"
          value={trackEvent}
          onChange={(event) => setTrackEvent(event.target.value)}
          className="rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[#0369a1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#075985] disabled:opacity-50"
        >
          Add item
        </button>
      </form>
      {itemError && <p className="mt-2 text-xs text-red-600">{itemError}</p>}
    </article>
  );
}
