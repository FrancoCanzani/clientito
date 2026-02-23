import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSdkConfig, updateSdkConfig } from "@/features/sdk/api/sdk_api";
import { InstallSnippet } from "@/features/sdk/components/install_snippet";
import { normalizeZIndex, updateSdkConfigFormSchema } from "@/features/sdk/sdk_schemas";

export function SdkConfigPage() {
  const { project_id: projectId } = useParams({ from: "/_dashboard/projects/$project_id/sdk" });
  const queryClient = useQueryClient();

  const configQuery = useQuery({
    queryKey: ["sdk-config", projectId],
    queryFn: () => fetchSdkConfig(projectId),
    enabled: true,
  });

  const updateConfigMutation = useMutation({
    mutationFn: (payload: { projectId: string; data: Parameters<typeof updateSdkConfig>[1] }) =>
      updateSdkConfig(payload.projectId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sdk-config", projectId] });
    },
  });

  const config = configQuery.data?.data;
  const sdkKey = configQuery.data?.sdkKey ?? "...";
  const formKey = String(config?.updatedAt ?? "default");

  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-lg border border-[#e2e8f0] bg-white p-4">
      <h1 className="text-base font-semibold text-[#0f172a]">SDK setup</h1>
      <p className="-mt-2 text-xs text-[#64748b]">Install and configure your widget</p>
        {configQuery.error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Failed to load SDK config: {configQuery.error.message}
          </p>
        )}

        <InstallSnippet sdkKey={sdkKey} />

        <section>
          <h3 className="text-xs font-medium text-[#334155]">SDK key</h3>
          <code className="mt-1 block rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-2 text-[11px] text-[#334155]">{sdkKey}</code>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-[#0f172a]">Widget configuration</h2>
          <form
            key={formKey}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);

              const parsed = updateSdkConfigFormSchema.safeParse({
                position: String(formData.get("position") ?? "bottom-right"),
                zIndex: normalizeZIndex(formData.get("zIndex")),
                customCss: String(formData.get("customCss") ?? "").trim() || null,
                theme: {},
              });

              if (!parsed.success) {
                return;
              }

              updateConfigMutation.mutate({
                projectId,
                data: parsed.data,
              });
            }}
            className="mt-3 space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-[#334155]">Position</label>
              <select
                name="position"
                defaultValue={config?.position ?? "bottom-right"}
                className="mt-1 block h-8 w-full rounded-md border border-[#d6e2f4] px-2.5 text-xs"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
                <option value="center">Center</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#334155]">Z-index</label>
              <input
                name="zIndex"
                type="number"
                defaultValue={config?.zIndex ?? 99999}
                className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#334155]">Custom CSS</label>
              <textarea
                name="customCss"
                rows={5}
                defaultValue={config?.customCss ?? ""}
                placeholder=".rl-modal { border-radius: 8px; }"
                className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 font-mono text-[12px]"
              />
            </div>

            {updateConfigMutation.error && <p className="text-xs text-red-600">{updateConfigMutation.error.message}</p>}
            {updateConfigMutation.isSuccess && <p className="text-xs text-emerald-700">Configuration saved.</p>}

            <button
              type="submit"
              disabled={updateConfigMutation.isPending}
              className="rounded-md bg-[#0369a1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#075985] disabled:opacity-50"
            >
              {updateConfigMutation.isPending ? "Saving..." : "Save configuration"}
            </button>
          </form>
        </section>
      </div>
  );
}
