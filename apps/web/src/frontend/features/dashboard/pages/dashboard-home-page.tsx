import { useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
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
import CreateProjectSheet from "@/features/workspace/components/create-project-sheet";

const organizationRouteApi = getRouteApi("/_dashboard/$orgId");

export default function DashboardHomePage() {
  const [isProjectSheetOpen, setIsProjectSheetOpen] = useState(false);
  const { orgId, projects } = organizationRouteApi.useLoaderData();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <CreateProjectSheet
        orgId={orgId}
        open={isProjectSheetOpen}
        onOpenChange={setIsProjectSheetOpen}
      />

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Projects</CardTitle>
          <div>
            <Button type="button" onClick={() => setIsProjectSheetOpen(true)}>
              Create project
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {projects.length === 0 ? (
            <Empty className="border-border/80">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderKanban />
                </EmptyMedia>
                <EmptyTitle>No projects in this organization</EmptyTitle>
                <EmptyDescription>
                  Create your first project to populate the sidebar and open the releases route.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" onClick={() => setIsProjectSheetOpen(true)}>
                  Create project
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to="/$orgId/projects/$projectId/releases"
                  params={{
                    orgId,
                    projectId: project.id,
                  }}
                  className="block rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {project.name}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
