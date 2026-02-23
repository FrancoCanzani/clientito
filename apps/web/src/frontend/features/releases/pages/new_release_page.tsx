import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { DisplayType } from "@releaselayer/shared";
import { createRelease } from "@/features/releases/api/release_api";
import { ReleaseScheduleFields } from "@/features/releases/components/release_schedule_fields";
import { createReleaseFormSchema, parseSchedule, toReleaseSlug } from "@/features/releases/release_schemas";

export function NewReleasePage() {
  const { project_id: projectId } = useParams({ from: "/_dashboard/projects/$project_id/releases/new" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [version, setVersion] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [displayType, setDisplayType] = useState<DisplayType>("modal");
  const [showOnce, setShowOnce] = useState(true);
  const [publishAtInput, setPublishAtInput] = useState("");
  const [unpublishAtInput, setUnpublishAtInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createReleaseMutation = useMutation({
    mutationFn: (payload: { projectId: string; data: Parameters<typeof createRelease>[1] }) =>
      createRelease(payload.projectId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases", projectId] });
      navigate({ to: "/projects/$project_id", params: { project_id: projectId } });
    },
  });

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-[#e2e8f0] bg-white p-4">
      <h1 className="mb-1 text-base font-semibold text-[#0f172a]">New release</h1>
      <p className="mb-4 text-xs text-[#64748b]">Draft and schedule your rollout</p>
      <form
          onSubmit={(event) => {
            event.preventDefault();

            const schedule = parseSchedule(publishAtInput, unpublishAtInput);
            if (!schedule.ok) {
              setFormError(schedule.error);
              return;
            }

            const parsed = createReleaseFormSchema.safeParse({
              title,
              slug,
              version: version || undefined,
              contentMd,
              displayType,
              showOnce,
              publishAt: schedule.publishAt,
              unpublishAt: schedule.unpublishAt,
            });
            if (!parsed.success) {
              setFormError(parsed.error.issues[0]?.message ?? "Invalid release payload.");
              return;
            }

            setFormError(null);
            createReleaseMutation.mutate({
              projectId,
              data: parsed.data,
            });
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-[#334155]">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(event) => {
                const nextTitle = event.target.value;
                setTitle(nextTitle);
                setSlug(toReleaseSlug(nextTitle));
              }}
              className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#334155]">Slug</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#334155]">Version</label>
              <input
                type="text"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="e.g. 1.0.0"
                className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155]">Display type</label>
            <select
              value={displayType}
              onChange={(event) => setDisplayType(event.target.value as DisplayType)}
              className="mt-1 block h-8 w-full rounded-md border border-[#d6e2f4] px-2.5 text-xs"
            >
              <option value="modal">Modal</option>
              <option value="banner">Banner</option>
              <option value="changelog">Changelog</option>
            </select>
          </div>

          <ReleaseScheduleFields
            publishAtValue={publishAtInput}
            unpublishAtValue={unpublishAtInput}
            onPublishAtChange={setPublishAtInput}
            onUnpublishAtChange={setUnpublishAtInput}
          />

          <div className="flex items-center gap-2">
            <input
              id="showOnce"
              type="checkbox"
              checked={showOnce}
              onChange={(event) => setShowOnce(event.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="showOnce" className="text-xs text-[#334155]">
              Show once per user
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#334155]">Content (Markdown)</label>
            <textarea
              required
              rows={10}
              value={contentMd}
              onChange={(event) => setContentMd(event.target.value)}
              className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 font-mono text-[12px]"
            />
          </div>

          {(formError || createReleaseMutation.error) && (
            <p className="text-xs text-red-600">{formError ?? createReleaseMutation.error?.message}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createReleaseMutation.isPending}
              className="rounded-md bg-[#0369a1] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#075985] disabled:opacity-50"
            >
              {createReleaseMutation.isPending ? "Creating..." : "Create release"}
            </button>
            <button
              type="button"
              onClick={() =>
                navigate({ to: "/projects/$project_id", params: { project_id: projectId } })
              }
              className="rounded-md border border-[#d6e2f4] px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f8fafc]"
            >
              Cancel
            </button>
          </div>
        </form>
    </div>
  );
}
