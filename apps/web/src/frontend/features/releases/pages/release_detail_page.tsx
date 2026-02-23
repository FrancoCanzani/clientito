import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { DisplayType } from "@releaselayer/shared";
import { deleteRelease, fetchRelease, publishRelease, updateRelease } from "@/features/releases/api/release_api";
import { ReleaseScheduleFields } from "@/features/releases/components/release_schedule_fields";
import {
  formatDateTimeInput,
  parseSchedule,
  updateReleaseFormSchema,
} from "@/features/releases/release_schemas";

export function ReleaseDetailPage() {
  const { project_id: projectId, release_id: releaseId } = useParams({
    from: "/_dashboard/projects/$project_id/releases/$release_id",
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const releaseQuery = useQuery({
    queryKey: ["release", releaseId],
    queryFn: () => fetchRelease(releaseId),
    enabled: true,
  });

  const publishMutation = useMutation({
    mutationFn: () => publishRelease(releaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release", releaseId] });
      queryClient.invalidateQueries({ queryKey: ["releases", projectId] });
    },
  });

  const updateReleaseMutation = useMutation({
    mutationFn: (payload: { releaseId: string; data: Parameters<typeof updateRelease>[1] }) =>
      updateRelease(payload.releaseId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release", releaseId] });
      queryClient.invalidateQueries({ queryKey: ["releases", projectId] });
    },
  });

  const deleteReleaseMutation = useMutation({
    mutationFn: () => deleteRelease(releaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases", projectId] });
      navigate({ to: "/projects/$project_id", params: { project_id: projectId } });
    },
  });

  const release = releaseQuery.data?.data;
  const formKey = String(release?.updatedAt ?? "draft");

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-[#e2e8f0] bg-white p-4">
      <h1 className="mb-1 text-base font-semibold text-[#0f172a]">{release?.title ?? "Release"}</h1>
      <p className="mb-4 text-xs text-[#64748b]">Edit and publish settings</p>
      {releaseQuery.error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Failed to load release: {releaseQuery.error.message}
        </p>
      )}

      {release && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#0f172a]">{release.title}</h2>
              <div className="mt-0.5 text-xs text-[#64748b]">
                {release.version && <span className="mr-3">v{release.version}</span>}
                {release.displayType} · {release.status}
              </div>
            </div>
            {release.status === "draft" && (
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {publishMutation.isPending ? "Publishing..." : "Publish"}
              </button>
            )}
          </div>

          <form
            key={formKey}
            className="space-y-3 rounded-md border border-[#e2e8f0] bg-[#fbfdff] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);

              const schedule = parseSchedule(
                String(formData.get("publishAt") ?? ""),
                String(formData.get("unpublishAt") ?? "")
              );
              if (!schedule.ok) {
                setFormError(schedule.error);
                return;
              }

              const parsed = updateReleaseFormSchema.safeParse({
                title: String(formData.get("title") ?? "").trim(),
                slug: String(formData.get("slug") ?? "").trim(),
                version: String(formData.get("version") ?? "").trim() || undefined,
                contentMd: String(formData.get("contentMd") ?? ""),
                displayType: String(formData.get("displayType") ?? "modal") as DisplayType,
                showOnce: formData.get("showOnce") === "on",
                publishAt: schedule.publishAt,
                unpublishAt: schedule.unpublishAt,
              });
              if (!parsed.success) {
                setFormError(parsed.error.issues[0]?.message ?? "Invalid release payload.");
                return;
              }

              setFormError(null);
              updateReleaseMutation.mutate({
                releaseId,
                data: parsed.data,
              });
            }}
          >
            <h3 className="text-xs font-semibold text-[#334155]">Edit release</h3>
            <div>
              <label className="block text-xs font-medium text-[#334155]">Title</label>
              <input
                name="title"
                required
                defaultValue={release.title}
                className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#334155]">Slug</label>
                <input
                  name="slug"
                  required
                  defaultValue={release.slug}
                  className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155]">Version</label>
                <input
                  name="version"
                  defaultValue={release.version ?? ""}
                  className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155]">Display type</label>
              <select
                name="displayType"
                defaultValue={release.displayType}
                className="mt-1 block h-8 w-full rounded-md border border-[#d6e2f4] px-2.5 text-xs"
              >
                <option value="modal">Modal</option>
                <option value="banner">Banner</option>
                <option value="changelog">Changelog</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="showOnce"
                name="showOnce"
                type="checkbox"
                defaultChecked={release.showOnce}
                className="h-4 w-4"
              />
              <label htmlFor="showOnce" className="text-xs text-[#334155]">
                Show once per user
              </label>
            </div>

            <ReleaseScheduleFields
              publishAtName="publishAt"
              unpublishAtName="unpublishAt"
              publishAtDefaultValue={formatDateTimeInput(release.publishAt)}
              unpublishAtDefaultValue={formatDateTimeInput(release.unpublishAt)}
            />

            <div>
              <label className="block text-xs font-medium text-[#334155]">Content (Markdown)</label>
              <textarea
                name="contentMd"
                rows={10}
                defaultValue={release.contentMd}
                className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 font-mono text-[12px]"
              />
            </div>
            {(formError || updateReleaseMutation.error) && (
              <p className="text-xs text-red-600">{formError ?? updateReleaseMutation.error?.message}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateReleaseMutation.isPending}
                className="rounded-md bg-[#0369a1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#075985] disabled:opacity-50"
              >
                {updateReleaseMutation.isPending ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => deleteReleaseMutation.mutate()}
                disabled={deleteReleaseMutation.isPending}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleteReleaseMutation.isPending ? "Deleting..." : "Delete release"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
