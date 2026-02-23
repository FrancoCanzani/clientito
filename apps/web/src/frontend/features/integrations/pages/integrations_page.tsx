import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus } from "lucide-react";
import { useState } from "react";
import type { IntegrationType } from "@releaselayer/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createIntegration,
  deleteIntegration,
  fetchIntegrations,
  toggleIntegration,
  updateIntegration,
} from "@/features/integrations/api/integration_api";
import { IntegrationCard } from "@/features/integrations/components/integration_card";
import {
  createIntegrationFormSchema,
  parseJsonRecord,
} from "@/features/integrations/integration_schemas";

export function IntegrationsPage() {
  const { project_id: projectId } = useParams({
    from: "/_dashboard/projects/$project_id/integrations",
  });
  const queryClient = useQueryClient();

  const [type, setType] = useState<IntegrationType>("slack");
  const [configJson, setConfigJson] = useState(
    '{\n  "webhookUrl": "https://example.com/webhook"\n}'
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const integrationsQuery = useQuery({
    queryKey: ["integrations", projectId],
    queryFn: () => fetchIntegrations(projectId),
    enabled: true,
  });

  const createIntegrationMutation = useMutation({
    mutationFn: (payload: { projectId: string; data: Parameters<typeof createIntegration>[1] }) =>
      createIntegration(payload.projectId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
      setFormError(null);
      setShowCreateForm(false);
    },
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: (payload: {
      integrationId: string;
      data: Parameters<typeof updateIntegration>[1];
    }) => updateIntegration(payload.integrationId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
    },
  });

  const toggleIntegrationMutation = useMutation({
    mutationFn: (integrationId: string) => toggleIntegration(integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
    },
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: (integrationId: string) => deleteIntegration(integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
    },
  });

  const integrations = integrationsQuery.data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-lg border border-[#e2e8f0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h1 className="text-base font-semibold text-[#0f172a]">Integrations</h1>
            <p className="text-xs text-[#64748b]">Connect release events to your tools</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreateForm((current) => !current)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add integration
          </Button>
        </div>
      </section>

      {integrationsQuery.error && (
        <Card size="sm" className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm text-red-800">Could not load integrations</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-red-700">
            {integrationsQuery.error.message}
          </CardContent>
        </Card>
      )}

      {showCreateForm && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Create integration</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const parsedConfig = parseJsonRecord(configJson);
                if (!parsedConfig.ok) {
                  setFormError(parsedConfig.error);
                  return;
                }

                const parsed = createIntegrationFormSchema.safeParse({
                  type,
                  config: parsedConfig.data,
                  isActive: true,
                });
                if (!parsed.success) {
                  setFormError(parsed.error.issues[0]?.message ?? "Invalid integration payload.");
                  return;
                }

                setFormError(null);
                createIntegrationMutation.mutate({ projectId, data: parsed.data });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="integration-type">Type</Label>
                <select
                  id="integration-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as IntegrationType)}
                  className="h-8 w-full rounded-md border border-[#d6e2f4] bg-white px-2.5 text-xs"
                >
                  <option value="slack">Slack</option>
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="custom_webhook">Custom Webhook</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="integration-config">Config JSON</Label>
                <Textarea
                  id="integration-config"
                  rows={6}
                  value={configJson}
                  onChange={(event) => setConfigJson(event.target.value)}
                  className="font-mono text-[12px]"
                />
              </div>
              {(formError || createIntegrationMutation.error) && (
                <p className="text-xs text-red-600">
                  {formError ?? createIntegrationMutation.error?.message}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={createIntegrationMutation.isPending}>
                  {createIntegrationMutation.isPending ? "Adding..." : "Add integration"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {(updateIntegrationMutation.error ||
        toggleIntegrationMutation.error ||
        deleteIntegrationMutation.error) && (
        <Card size="sm" className="border-red-200 bg-red-50">
          <CardContent className="pt-3 text-xs text-red-700">
            {updateIntegrationMutation.error?.message ??
              toggleIntegrationMutation.error?.message ??
              deleteIntegrationMutation.error?.message}
          </CardContent>
        </Card>
      )}

      <section className="space-y-2.5">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            onSave={(data) =>
              updateIntegrationMutation.mutate({
                integrationId: integration.id,
                data,
              })
            }
            onToggle={() => toggleIntegrationMutation.mutate(integration.id)}
            onDelete={() => deleteIntegrationMutation.mutate(integration.id)}
            busy={
              updateIntegrationMutation.isPending ||
              toggleIntegrationMutation.isPending ||
              deleteIntegrationMutation.isPending
            }
          />
        ))}

        {!integrationsQuery.isLoading && integrations.length === 0 && (
          <Empty className="border-border/80">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Link2 />
              </EmptyMedia>
              <EmptyTitle>No integrations yet</EmptyTitle>
              <EmptyDescription>
                Add your first integration to route release events into your product and ops
                workflows.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" size="sm" onClick={() => setShowCreateForm(true)}>
                Add integration
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>
    </div>
  );
}
