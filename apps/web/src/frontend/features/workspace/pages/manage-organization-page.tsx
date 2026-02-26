import { getRouteApi, useRouter } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateOrganization } from "@/features/workspace/api";

const orgRoute = getRouteApi("/_dashboard/$orgId");

export default function ManageOrganizationPage() {
  const { organization, orgId } = orgRoute.useLoaderData();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(organization.name);

  useEffect(() => {
    setName(organization.name);
  }, [organization.name]);

  const save = useMutation({
    mutationFn: () => updateOrganization(orgId, { name: name.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspace", "orgs"] });
      await router.invalidate();
    },
  });

  const nextName = name.trim();
  const canSave = nextName.length > 0 && nextName !== organization.name && !save.isPending;
  const createdAtMs =
    organization.createdAt < 1_000_000_000_000
      ? organization.createdAt * 1000
      : organization.createdAt;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-lg font-medium">Manage organization</h2>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Role: {organization.role}</p>
          <p>Created: {new Date(createdAtMs).toLocaleDateString()}</p>
          <p>Organization ID: {organization.id}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Organization name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Organization name"
          />

          {save.error ? (
            <p className="text-xs text-destructive">
              {save.error instanceof Error ? save.error.message : "Failed to update organization."}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button onClick={() => save.mutate()} disabled={!canSave}>
              {save.isPending ? "Saving..." : "Save changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setName(organization.name)}
              disabled={save.isPending || name === organization.name}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
