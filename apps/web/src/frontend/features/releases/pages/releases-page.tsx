import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchReleases } from "@/features/releases/api/release-api";
import CreateReleaseSheet from "@/features/releases/components/create-release-sheet";

export default function ReleasesPage() {
  const params = useParams({ from: "/_dashboard/$orgId/projects/$projectId/releases/" });
  const orgId = params["orgId"];
  const projectId = params["projectId"];
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["releases", projectId],
    queryFn: () => fetchReleases(projectId),
  });

  const releases = data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Releases</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New release
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : releases.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No releases yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {releases.map((release) => (
            <Link
              key={release.id}
              to="/$orgId/projects/$projectId/releases/$releaseId"
              params={{ orgId, projectId, releaseId: release.id }}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{release.title}</CardTitle>
                    <Badge variant={release.status === "published" ? "default" : "secondary"}>
                      {release.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {release.version && <span>v{release.version}</span>}
                    <span>{new Date(release.createdAt * 1000).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateReleaseSheet
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
