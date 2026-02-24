import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchGithubConnection,
  createGithubConnection,
  deleteGithubConnection,
} from "@/features/releases/api/release-api";

type GithubConnectProps = {
  projectId: string;
};

export default function GithubConnect({ projectId }: GithubConnectProps) {
  const queryClient = useQueryClient();
  const [repoInput, setRepoInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["github-connection", projectId],
    queryFn: () => fetchGithubConnection(projectId),
  });

  const connection = data?.data ?? null;

  const createMutation = useMutation({
    mutationFn: createGithubConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-connection", projectId] });
      setRepoInput("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGithubConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-connection", projectId] });
    },
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading...</p>;

  if (connection) {
    return (
      <div className="flex items-center justify-between rounded-md border p-2">
        <div>
          <p className="text-sm font-medium">
            {connection.repoOwner}/{connection.repoName}
          </p>
          <p className="text-xs text-muted-foreground">Connected at project level</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => deleteMutation.mutate(connection.id)}
          disabled={deleteMutation.isPending}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const parts = repoInput.trim().split("/");
        if (parts.length !== 2 || !parts[0] || !parts[1]) return;
        createMutation.mutate({
          projectId,
          repoOwner: parts[0],
          repoName: parts[1],
        });
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="repo-input">Repository (owner/repo)</Label>
        <p className="text-xs text-muted-foreground">
          This links GitHub for the whole project, not just this release.
        </p>
        <Input
          id="repo-input"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          placeholder="acme/my-app"
        />
      </div>
      <Button type="submit" size="sm" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Connecting..." : "Connect"}
      </Button>
    </form>
  );
}
