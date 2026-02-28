import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateOrganization } from "@/features/workspace/api";

const orgRoute = getRouteApi("/_dashboard/$orgId");

export default function ManageOrganizationPage() {
  const { organization, orgId } = orgRoute.useLoaderData();
  const formKey = `${orgId}:${organization.name}:${organization.aiContext ?? ""}`;

  return (
    <ManageOrganizationForm
      key={formKey}
      orgId={orgId}
      organization={organization}
    />
  );
}

function ManageOrganizationForm({
  orgId,
  organization,
}: {
  orgId: string;
  organization: ReturnType<typeof orgRoute.useLoaderData>["organization"];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(() => organization.name);
  const [aiContext, setAiContext] = useState(() => organization.aiContext ?? "");

  const save = useMutation({
    mutationFn: () =>
      updateOrganization(orgId, {
        name: name.trim(),
        aiContext: aiContext.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspace", "orgs"] });
      await router.invalidate();
    },
  });

  const nextName = name.trim();
  const nextAiContext = aiContext.trim() || null;
  const hasChanges =
    nextName !== organization.name ||
    nextAiContext !== (organization.aiContext ?? null);
  const canSave = nextName.length > 0 && hasChanges && !save.isPending;
  const createdAtMs =
    organization.createdAt < 1_000_000_000_000
      ? organization.createdAt * 1000
      : organization.createdAt;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <h2 className="text-lg font-medium tracking-tight">Organization settings</h2>
        <p className="text-sm text-muted-foreground">
          Update your workspace name and business context used by AI features.
        </p>
      </header>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Details
        </h3>
        <div className="divide-y">
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{organization.role}</span>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(createdAtMs).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-muted-foreground">Organization ID</span>
            <span className="truncate font-mono text-xs">{organization.id}</span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="organization-name">Organization name</Label>
          <Input
            id="organization-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Organization name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="organization-ai-context">Business context for AI</Label>
          <p className="text-xs text-muted-foreground">
            Describe your business so classification, summaries, and analysis are tailored to your domain.
          </p>
          <Textarea
            id="organization-ai-context"
            value={aiContext}
            onChange={(event) => setAiContext(event.target.value)}
            placeholder="e.g. We are a transport/logistics company. Our customers request quotes, shipments, pickups, and deliveries."
            rows={4}
            className="min-h-24"
          />
        </div>
      </section>

      {save.error ? (
        <p className="text-xs text-destructive">
          {save.error instanceof Error
            ? save.error.message
            : "Failed to update organization."}
        </p>
      ) : null}

      <div className="flex items-center gap-2 border-t pt-3">
        <Button onClick={() => save.mutate()} disabled={!canSave}>
          {save.isPending ? "Saving..." : "Save changes"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setName(organization.name);
            setAiContext(organization.aiContext ?? "");
          }}
          disabled={save.isPending || !hasChanges}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
