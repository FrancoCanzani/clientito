import { useState } from "react";
import type { Integration, IntegrationType } from "@releaselayer/shared";
import { createIntegrationFormSchema, parseJsonRecord } from "@/features/integrations/integration_schemas";
import type { UpdateIntegrationInput } from "@/features/integrations/integration_types";

interface IntegrationCardProps {
  integration: Integration;
  onSave: (data: UpdateIntegrationInput) => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}

export function IntegrationCard({ integration, onSave, onToggle, onDelete, busy }: IntegrationCardProps) {
  const configFormKey = `${integration.id}-${integration.type}-${JSON.stringify(integration.config)}`;
  const [cardError, setCardError] = useState<string | null>(null);

  return (
    <article className="rounded-lg border border-[#e2e8f0] bg-white p-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">{integration.type}</h3>
          <p className="mt-0.5 text-xs text-[#64748b]">
            {integration.isActive ? "Active" : "Inactive"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggle}
            disabled={busy}
            className="rounded-md border border-[#d6e2f4] px-2.5 py-1 text-[11px] text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            {integration.isActive ? "Disable" : "Enable"}
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
          const nextType = String(formData.get("editType") ?? "slack") as IntegrationType;
          const nextConfigJson = String(formData.get("editConfigJson") ?? "");

          const parsedConfig = parseJsonRecord(nextConfigJson);
          if (!parsedConfig.ok) {
            setCardError(parsedConfig.error);
            return;
          }

          const parsed = createIntegrationFormSchema.pick({ type: true, config: true }).safeParse({
            type: nextType,
            config: parsedConfig.data,
          });
          if (!parsed.success) {
            setCardError(parsed.error.issues[0]?.message ?? "Invalid integration config.");
            return;
          }

          onSave({
            type: parsed.data.type,
            config: parsed.data.config,
          });
          setCardError(null);
        }}
      >
        <h4 className="text-xs font-semibold text-[#334155]">Integration config</h4>
        <select
          name="editType"
          defaultValue={integration.type}
          className="block h-8 w-full rounded-md border border-[#d6e2f4] px-2.5 text-xs"
        >
          <option value="slack">Slack</option>
          <option value="github">GitHub</option>
          <option value="gitlab">GitLab</option>
          <option value="custom_webhook">Custom Webhook</option>
        </select>
        <textarea
          name="editConfigJson"
          rows={6}
          defaultValue={JSON.stringify(integration.config, null, 2)}
          className="block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 font-mono text-[11px]"
        />
        {cardError && <p className="text-xs text-red-600">{cardError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          Save config
        </button>
      </form>
    </article>
  );
}
