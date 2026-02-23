import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FolderKanban, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/api/auth_api";
import { createProject, fetchProjects } from "@/features/projects/api/project_api";
import {
  createProjectFormSchema,
  getStoredOrgId,
  ORG_CHANGED_EVENT,
  toSlug,
} from "@/features/projects/project_schemas";

export function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState(() => getStoredOrgId());

  useEffect(() => {
    const handleOrgChange = () => {
      setSelectedOrgId(getStoredOrgId());
    };

    window.addEventListener(ORG_CHANGED_EVENT, handleOrgChange);
    return () => window.removeEventListener(ORG_CHANGED_EVENT, handleOrgChange);
  }, []);

  const orgId =
    user?.orgs.find((org) => org.orgId === selectedOrgId)?.orgId ??
    user?.orgs[0]?.orgId ??
    "";
  const selectedOrg = user?.orgs.find((org) => org.orgId === orgId) ?? null;

  const projectsQuery = useQuery({
    queryKey: ["projects", orgId],
    queryFn: () => fetchProjects(orgId),
    enabled: Boolean(orgId),
  });

  const createProjectMutation = useMutation({
    mutationFn: (payload: { orgId: string; name: string; slug: string }) =>
      createProject(payload.orgId, { name: payload.name, slug: payload.slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", orgId] });
      setShowCreate(false);
      setName("");
      setSlug("");
      setFormError(null);
    },
  });

  const projects = projectsQuery.data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-lg border border-[#e2e8f0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-[#0f172a]">Projects</h1>
            <p className="text-xs text-[#64748b]">
              {selectedOrg ? selectedOrg.orgName : "Pick an org to continue"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => setShowCreate((current) => !current)}
              disabled={!orgId}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              New project
            </Button>
          </div>
        </div>
      </section>

      {!user?.orgs.length && (
        <Empty className="border-border/80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No organizations yet</EmptyTitle>
            <EmptyDescription>
              Your workspace does not have an organization membership yet. Sign out and create a
              fresh account, or ask an admin to invite you.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {projectsQuery.error && (
        <Card size="sm" className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm text-red-800">Could not load projects</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-red-700">
            {projectsQuery.error.message}
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card size="sm" className="border-border/80">
          <CardHeader>
            <CardTitle className="text-sm">Create project</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();

                const parsed = createProjectFormSchema.safeParse({ name, slug });
                if (!parsed.success) {
                  setFormError(parsed.error.issues[0]?.message ?? "Invalid project payload.");
                  return;
                }

                setFormError(null);
                createProjectMutation.mutate({ orgId, ...parsed.data });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setName(nextName);
                    setSlug(toSlug(nextName));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-slug">Slug</Label>
                <Input
                  id="project-slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>
              {(formError || createProjectMutation.error) && (
                <p className="text-xs text-red-600">
                  {formError ?? createProjectMutation.error?.message}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={createProjectMutation.isPending || !orgId}
                >
                  {createProjectMutation.isPending ? "Creating..." : "Create"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <section className="space-y-2.5">
        {projects.map((project) => (
          <Link key={project.id} to="/projects/$project_id" params={{ project_id: project.id }}>
            <Card size="sm" className="border-border/80 transition-colors hover:border-[#c2d6fb]">
              <CardContent className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-sm font-medium text-[#0f172a]">{project.name}</div>
                  <div className="text-[11px] text-[#64748b]">/{project.slug}</div>
                </div>
                <FolderKanban className="h-4 w-4 text-[#94a3b8]" />
              </CardContent>
            </Card>
          </Link>
        ))}

        {!projectsQuery.isLoading && projects.length === 0 && user?.orgs.length ? (
          <Empty className="border-border/80">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderKanban />
              </EmptyMedia>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>
                Create your first project to start planning releases, checklists, and integrations.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
                Create project
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}
      </section>
    </div>
  );
}
