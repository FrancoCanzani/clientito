import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileClock, Rocket, SquareDashedBottomCode } from "lucide-react";
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
import {
  fetchProject,
  fetchProjectReleases,
  fetchUsageSummary,
} from "@/features/projects/api/project_api";

export function ProjectDetailPage() {
  const { project_id: projectId } = useParams({ from: "/_dashboard/projects/$project_id/" });
  const navigate = useNavigate();

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(projectId),
    enabled: true,
  });

  const releasesQuery = useQuery({
    queryKey: ["releases", projectId],
    queryFn: () => fetchProjectReleases(projectId),
    enabled: true,
  });

  const usageQuery = useQuery({
    queryKey: ["usage", projectId],
    queryFn: () => fetchUsageSummary(projectId),
    enabled: true,
  });

  const project = projectQuery.data?.data;
  const releases = releasesQuery.data?.data ?? [];

  if (projectQuery.error) {
    return (
      <Empty className="border-border/80">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SquareDashedBottomCode />
          </EmptyMedia>
          <EmptyTitle>Project not available</EmptyTitle>
          <EmptyDescription>
            {`We could not load this project. ${projectQuery.error.message}`}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-lg border border-[#e2e8f0] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-[#0f172a]">
              {project?.name ?? "Project"}
            </h1>
            <p className="text-xs text-[#64748b]">Release performance and rollout control</p>
          </div>
          <Link to="/projects/$project_id/releases/new" params={{ project_id: projectId }}>
            <Button size="sm" className="gap-1.5">
              <Rocket className="h-3.5 w-3.5" />
              New release
            </Button>
          </Link>
        </div>
      </section>

      <nav className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white p-1.5">
        <span className="rounded-md bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8]">
          Releases
        </span>
        <Link
          to="/projects/$project_id/sdk"
          params={{ project_id: projectId }}
          className="rounded-md px-2.5 py-1 text-xs text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#334155]"
        >
          SDK
        </Link>
        <Link
          to="/projects/$project_id/checklists"
          params={{ project_id: projectId }}
          className="rounded-md px-2.5 py-1 text-xs text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#334155]"
        >
          Checklists
        </Link>
        <Link
          to="/projects/$project_id/integrations"
          params={{ project_id: projectId }}
          className="rounded-md px-2.5 py-1 text-xs text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#334155]"
        >
          Integrations
        </Link>
      </nav>

      {usageQuery.data?.data ? (
        <section className="grid gap-2.5 md:grid-cols-3">
          <MetricCard title="Today MAU" value={String(usageQuery.data.data.todayStats.mau)} />
          <MetricCard title="Month MAU" value={String(usageQuery.data.data.currentMonth.mau)} />
          <MetricCard
            title="Month impressions"
            value={String(usageQuery.data.data.currentMonth.impressions)}
          />
        </section>
      ) : null}

      {usageQuery.error && (
        <Card size="sm" className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm text-yellow-900">Usage metrics unavailable</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-yellow-800">
            {usageQuery.error.message}
          </CardContent>
        </Card>
      )}

      <section className="space-y-2.5">
        {releasesQuery.error && (
          <Card size="sm" className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-sm text-red-800">Could not load releases</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-red-700">
              {releasesQuery.error.message}
            </CardContent>
          </Card>
        )}

        {releases.map((release) => (
          <Link
            key={release.id}
            to="/projects/$project_id/releases/$release_id"
            params={{ project_id: projectId, release_id: release.id }}
          >
            <Card size="sm" className="border-border/80 transition-colors hover:border-[#c2d6fb]">
              <CardContent className="space-y-1 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#0f172a]">{release.title}</div>
                  <span className="rounded-md border border-[#d6e3fb] bg-[#eef4ff] px-2 py-0.5 text-[11px] font-medium text-[#1d4ed8]">
                    {release.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b]">
                  {release.version ? `v${release.version} · ` : ""}
                  {release.displayType}
                </div>
                {(release.publishAt || release.unpublishAt) && (
                  <div className="flex items-center gap-1 text-[11px] text-[#64748b]">
                    <FileClock className="h-3.5 w-3.5" />
                    <span>
                      {release.publishAt ? `Starts ${formatEpoch(release.publishAt)}` : ""}
                      {release.publishAt && release.unpublishAt ? " · " : ""}
                      {release.unpublishAt ? `Ends ${formatEpoch(release.unpublishAt)}` : ""}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}

        {!releasesQuery.isLoading && releases.length === 0 ? (
          <Empty className="border-border/80">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Rocket />
              </EmptyMedia>
              <EmptyTitle>No releases yet</EmptyTitle>
              <EmptyDescription>
                Create your first release to start tracking adoption and scheduling visibility.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  navigate({
                    to: "/projects/$project_id/releases/new",
                    params: { project_id: projectId },
                  });
                }}
              >
                New release
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}
      </section>

      {project ? (
        <Card size="sm" className="border-border/80">
          <CardHeader>
            <CardTitle className="text-sm">SDK key</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <code className="block rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-2 text-[11px] text-[#334155]">
              {project.sdkKey}
            </code>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MetricCard(props: { title: string; value: string }) {
  return (
    <Card size="sm" className="border-border/80">
      <CardContent className="pt-3">
        <div className="text-[11px] uppercase tracking-[0.12em] text-[#64748b]">{props.title}</div>
        <div className="mt-1 text-lg font-semibold text-[#0f172a]">{props.value}</div>
      </CardContent>
    </Card>
  );
}

function formatEpoch(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString();
}
