import { useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createChecklist,
  createChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  fetchChecklists,
  updateChecklist,
} from "@/features/checklists/api/checklist_api";
import { ChecklistCard } from "@/features/checklists/components/checklist_card";
import {
  createChecklistFormSchema,
  parseOptionalJsonRecord,
} from "@/features/checklists/checklist_schemas";

export function ChecklistsPage() {
  const { project_id: projectId } = useParams({ from: "/_dashboard/projects/$project_id/checklists" });
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetTraitsJson, setTargetTraitsJson] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const checklistsQuery = useQuery({
    queryKey: ["checklists", projectId],
    queryFn: () => fetchChecklists(projectId),
    enabled: true,
  });

  const createChecklistMutation = useMutation({
    mutationFn: (payload: { projectId: string; data: Parameters<typeof createChecklist>[1] }) =>
      createChecklist(payload.projectId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", projectId] });
      setTitle("");
      setDescription("");
      setTargetTraitsJson("");
      setCreateError(null);
      setShowCreateForm(false);
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: (payload: { checklistId: string; data: Parameters<typeof updateChecklist>[1] }) =>
      updateChecklist(payload.checklistId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", projectId] });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: (checklistId: string) => deleteChecklist(checklistId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", projectId] });
    },
  });

  const createChecklistItemMutation = useMutation({
    mutationFn: (payload: {
      checklistId: string;
      data: Parameters<typeof createChecklistItem>[1];
    }) => createChecklistItem(payload.checklistId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", projectId] });
    },
  });

  const deleteChecklistItemMutation = useMutation({
    mutationFn: (payload: { checklistId: string; itemId: string }) =>
      deleteChecklistItem(payload.checklistId, payload.itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklists", projectId] });
    },
  });

  const checklists = checklistsQuery.data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-lg border border-[#e2e8f0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h1 className="text-base font-semibold text-[#0f172a]">Checklists</h1>
            <p className="text-xs text-[#64748b]">Onboarding and targeting rules</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreateForm((current) => !current)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New checklist
          </Button>
        </div>
      </section>

      {checklistsQuery.error && (
        <Card size="sm" className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm text-red-800">Could not load checklists</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-red-700">
            {checklistsQuery.error.message}
          </CardContent>
        </Card>
      )}

      {showCreateForm && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Create checklist</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();

                const targetTraitsResult = parseOptionalJsonRecord(targetTraitsJson);
                if (!targetTraitsResult.ok) {
                  setCreateError(targetTraitsResult.error);
                  return;
                }

                const parsed = createChecklistFormSchema.safeParse({
                  title,
                  description: description || undefined,
                  targetTraits: targetTraitsResult.data ?? undefined,
                });
                if (!parsed.success) {
                  setCreateError(parsed.error.issues[0]?.message ?? "Invalid checklist payload.");
                  return;
                }

                setCreateError(null);
                createChecklistMutation.mutate({ projectId, data: parsed.data });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="checklist-title">Title</Label>
                <Input
                  id="checklist-title"
                  type="text"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklist-description">Description</Label>
                <Input
                  id="checklist-description"
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="checklist-target-traits">Target traits JSON</Label>
                <Textarea
                  id="checklist-target-traits"
                  rows={4}
                  value={targetTraitsJson}
                  onChange={(event) => setTargetTraitsJson(event.target.value)}
                  placeholder='{"plan":"pro","region":["us","eu"]}'
                  className="font-mono text-[12px]"
                />
              </div>
              {(createError || createChecklistMutation.error) && (
                <p className="text-xs text-red-600">
                  {createError ?? createChecklistMutation.error?.message}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={createChecklistMutation.isPending}>
                  {createChecklistMutation.isPending ? "Creating..." : "Create checklist"}
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

      {(updateChecklistMutation.error ||
        deleteChecklistMutation.error ||
        createChecklistItemMutation.error ||
        deleteChecklistItemMutation.error) && (
        <Card size="sm" className="border-red-200 bg-red-50">
          <CardContent className="pt-3 text-xs text-red-700">
            {updateChecklistMutation.error?.message ??
              deleteChecklistMutation.error?.message ??
              createChecklistItemMutation.error?.message ??
              deleteChecklistItemMutation.error?.message}
          </CardContent>
        </Card>
      )}

      <section className="space-y-2.5">
        {checklists.map((checklist) => (
          <ChecklistCard
            key={checklist.id}
            checklist={checklist}
            onToggle={() => {
              updateChecklistMutation.mutate({
                checklistId: checklist.id,
                data: { isActive: !checklist.isActive },
              });
            }}
            onDelete={() => deleteChecklistMutation.mutate(checklist.id)}
            onUpdateConfig={(data) =>
              updateChecklistMutation.mutate({
                checklistId: checklist.id,
                data,
              })
            }
            onCreateItem={(data) =>
              createChecklistItemMutation.mutate({
                checklistId: checklist.id,
                data,
              })
            }
            onDeleteItem={(itemId) =>
              deleteChecklistItemMutation.mutate({
                checklistId: checklist.id,
                itemId,
              })
            }
            busy={
              updateChecklistMutation.isPending ||
              deleteChecklistMutation.isPending ||
              createChecklistItemMutation.isPending ||
              deleteChecklistItemMutation.isPending
            }
          />
        ))}

        {!checklistsQuery.isLoading && checklists.length === 0 && (
          <Empty className="border-border/80">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckSquare />
              </EmptyMedia>
              <EmptyTitle>No checklists yet</EmptyTitle>
              <EmptyDescription>
                Create a checklist to guide release adoption and track key onboarding actions.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" size="sm" onClick={() => setShowCreateForm(true)}>
                New checklist
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>
    </div>
  );
}
