import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteRelease,
  fetchRelease,
  generateNotes,
  updateRelease,
} from "@/features/releases/api/release-api";
import GithubConnect from "@/features/releases/components/github-connect";
import PrPicker from "@/features/releases/components/pr-picker";
import type { CreateReleaseItemInput } from "@/features/releases/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function ReleaseDetailPage() {
  const params = useParams({
    from: "/_dashboard/$orgId/projects/$projectId/releases/$releaseId",
  });
  const { orgId, projectId, releaseId } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["release", releaseId],
    queryFn: () => fetchRelease(releaseId),
  });

  const release = data?.data;

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write release notes..." }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] p-3 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!release) {
      return;
    }

    setTitle(release.title);
    setVersion(release.version ?? "");

    if (editor) {
      editor.commands.setContent(release.notes ?? "");
    }
  }, [editor, release]);

  const saveMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateRelease>[1]) =>
      updateRelease(releaseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["release", releaseId] });
      queryClient.invalidateQueries({ queryKey: ["releases", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRelease(releaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["releases", projectId] });
      void router.navigate({
        to: "/$orgId/projects/$projectId/releases",
        params: { orgId, projectId },
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateNotes(releaseId),
    onSuccess: (result) => {
      if (editor && result.data.notes) {
        editor.commands.setContent(result.data.notes);
      }
    },
  });

  function handleSave() {
    saveMutation.mutate({
      title: title.trim(),
      version: version.trim() || undefined,
      notes: editor?.getHTML() ?? undefined,
    });
  }

  function handlePublish() {
    saveMutation.mutate({
      title: title.trim(),
      version: version.trim() || undefined,
      notes: editor?.getHTML() ?? undefined,
      status: "published",
    });
  }

  function handleAddItems(items: CreateReleaseItemInput[]) {
    const existing =
      release?.items.map((i) => ({
        kind: i.kind,
        title: i.title,
        description: i.description ?? undefined,
        prNumber: i.prNumber ?? undefined,
        prUrl: i.prUrl ?? undefined,
        prAuthor: i.prAuthor ?? undefined,
        sortOrder: i.sortOrder,
      })) ?? [];

    saveMutation.mutate({
      items: [
        ...existing,
        ...items.map((item, index) => ({
          ...item,
          sortOrder: existing.length + index,
        })),
      ],
    });
  }

  function handleRemoveItem(index: number) {
    if (!release) return;
    const updated = release.items
      .filter((_, i) => i !== index)
      .map((item, i) => ({
        kind: item.kind,
        title: item.title,
        description: item.description ?? undefined,
        prNumber: item.prNumber ?? undefined,
        prUrl: item.prUrl ?? undefined,
        prAuthor: item.prAuthor ?? undefined,
        sortOrder: i,
      }));
    saveMutation.mutate({ items: updated });
  }

  if (isLoading)
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!release)
    return <p className="text-sm text-destructive">Release not found.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.navigate({
              to: "/$orgId/projects/$projectId/releases",
              params: { orgId, projectId },
            })
          }
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          <Badge
            variant={release.status === "published" ? "default" : "secondary"}
          >
            {release.status}
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="detail-title">Title</Label>
            <Input
              id="detail-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail-version">Version</Label>
            <Input
              id="detail-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Notes</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={
                generateMutation.isPending || release.items.length === 0
              }
            >
              <Sparkles className="mr-1 h-4 w-4" />
              {generateMutation.isPending ? "Generating..." : "Generate notes"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <EditorContent editor={editor} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Items ({release.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {release.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items yet. Add manually or sync from GitHub.
            </p>
          ) : (
            <ul className="space-y-2">
              {release.items.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between rounded-md border p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.kind}
                      </Badge>
                      {item.prNumber && (
                        <span className="text-xs text-muted-foreground">
                          PR #{item.prNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GitHub</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <GithubConnect projectId={projectId} />
          <PrPicker projectId={projectId} onAdd={handleAddItems} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 pb-8">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save draft"}
        </Button>
        {release.status === "draft" && (
          <Button
            variant="outline"
            onClick={handlePublish}
            disabled={saveMutation.isPending}
          >
            Publish
          </Button>
        )}
      </div>
    </div>
  );
}
