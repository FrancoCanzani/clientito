import { Button } from "@/components/ui/button";
import {
  fetchGithubConnection,
  fetchGithubPulls,
} from "@/features/releases/api/release-api";
import type { CreateReleaseItemInput } from "@/features/releases/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

type PrPickerProps = {
  projectId: string;
  onAdd: (items: CreateReleaseItemInput[]) => void;
};

export default function PrPicker({ projectId, onAdd }: PrPickerProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showPicker, setShowPicker] = useState(false);

  const { data: connectionData } = useQuery({
    queryKey: ["github-connection", projectId],
    queryFn: () => fetchGithubConnection(projectId),
  });

  const hasConnection = !!connectionData?.data;

  const {
    data: pullsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["github-pulls", projectId],
    queryFn: () => fetchGithubPulls(projectId),
    enabled: false,
  });

  const pulls = pullsData?.data ?? [];

  function handleSync() {
    setShowPicker(true);
    refetch();
  }

  function togglePr(prNumber: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(prNumber)) {
        next.delete(prNumber);
      } else {
        next.add(prNumber);
      }
      return next;
    });
  }

  function handleAdd() {
    const items: CreateReleaseItemInput[] = pulls
      .filter((pr) => selected.has(pr.number))
      .map((pr) => ({
        kind: "pr",
        title: pr.title,
        description: pr.body ?? undefined,
        prNumber: pr.number,
        prUrl: pr.htmlUrl,
        prAuthor: pr.author,
      }));

    onAdd(items);
    setSelected(new Set());
    setShowPicker(false);
  }

  if (!hasConnection) return null;

  return (
    <div className="space-y-2">
      {!showPicker ? (
        <Button variant="outline" size="sm" onClick={handleSync}>
          Sync PRs
        </Button>
      ) : (
        <>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Fetching PRs...</p>
          ) : pulls.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No merged PRs found.
            </p>
          ) : (
            <ul className="max-h-60 space-y-1 overflow-y-auto">
              {pulls.map((pr) => (
                <li key={pr.number}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selected.has(pr.number)}
                      onChange={() => togglePr(pr.number)}
                    />
                    <span className="font-medium">#{pr.number}</span>
                    <span className="flex-1 truncate">{pr.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {pr.author}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={selected.size === 0}
            >
              Add {selected.size} PR{selected.size !== 1 ? "s" : ""}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPicker(false)}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
