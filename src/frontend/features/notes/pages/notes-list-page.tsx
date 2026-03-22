import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { createNote } from "@/features/notes/mutations";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";

const notesRouteApi = getRouteApi("/_dashboard/notes/");

export default function NotesListPage() {
  const { notes } = notesRouteApi.useLoaderData();

  const navigate = useNavigate();
  const createNoteMutation = useMutation({
    mutationFn: async () =>
      createNote({
        title: "Untitled note",
        content: "",
      }),
    onSuccess: (created) => {
      navigate({
        to: "/notes/$noteId",
        params: { noteId: created.id },
      });
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Notes"
        actions={
          <Button
            type="button"
            onClick={() => createNoteMutation.mutate()}
            disabled={createNoteMutation.isPending}
            variant="secondary"
            size="sm"
          >
            {createNoteMutation.isPending ? "Creating..." : "New note"}
          </Button>
        }
      />

      <div className="space-y-2">
        {notes.length > 0 ? (
          notes.map((note) => (
            <Link
              to="/notes/$noteId"
              params={{ noteId: note.id }}
              key={note.id}
              className="w-full flex text-sm items-center justify-between rounded-md px-2 py-1 text-left hover:bg-muted/60"
            >
              <div className="truncate font-medium">
                {note.title || "Untitled note"}
              </div>
              <div className="text-xs font-mono tracking-tight text-muted-foreground">
                Updated{" "}
                {formatDistanceToNowStrict(new Date(note.updatedAt), {
                  addSuffix: true,
                })}
              </div>
            </Link>
          ))
        ) : (
          <Empty className="min-h-56 border-0 p-0">
            <EmptyHeader>
              <EmptyTitle>No notes yet</EmptyTitle>
              <EmptyDescription>
                Create a note to get started.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                type="button"
                onClick={() => createNoteMutation.mutate()}
                disabled={createNoteMutation.isPending}
                size="sm"
              >
                {createNoteMutation.isPending ? "Creating..." : "New note"}
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
    </div>
  );
}
