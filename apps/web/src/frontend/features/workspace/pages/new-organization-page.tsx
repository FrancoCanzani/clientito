import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createOrganization } from "@/features/workspace/api";

const dashboardRouteApi = getRouteApi("/_dashboard");

export default function NewOrganizationPage() {
  const { organizations } = dashboardRouteApi.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fallbackOrgId = organizations[0]?.id ?? null;

  const createOrgMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: async (result) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["workspace", "orgs"] });
      await router.invalidate();

      if (result.data?.id) {
        navigate({
          to: "/$orgId",
          params: { orgId: result.data.id },
        });
      }
    },
    onError: (error) => {
      setSubmitError(error instanceof Error ? error.message : "Failed to create organization.");
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();

    if (!nextName) {
      setSubmitError("Organization name is required.");
      return;
    }

    setSubmitError(null);
    createOrgMutation.mutate({ name: nextName });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create new organization</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add another workspace for a different team or operation.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="org-name" className="text-xs text-muted-foreground">
                Organization name
              </label>
              <Input
                id="org-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Logistics"
                autoFocus
                required
              />
            </div>

            {submitError ? (
              <p className="text-xs text-destructive">{submitError}</p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={createOrgMutation.isPending}>
                {createOrgMutation.isPending ? "Creating..." : "Create organization"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  fallbackOrgId
                    ? navigate({
                        to: "/$orgId",
                        params: { orgId: fallbackOrgId },
                      })
                    : null
                }
                disabled={!fallbackOrgId}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
