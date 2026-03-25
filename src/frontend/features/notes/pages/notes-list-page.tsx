import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { createNote, deleteNote, updateNote } from "@/features/notes/mutations";
import type { NoteSummary } from "@/features/notes/types";
import { PushPinIcon, TrashIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";

const notesRouteApi = getRouteApi("/_dashboard/notes/");

export default function NotesListPage() {
  const { notes } = notesRouteApi.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();

  const createNoteMutation = useMutation({
    mutationFn: async () =>
      createNote({ title: "Untitled note", content: "" }),
    onSuccess: (created) => {
      navigate({ to: "/notes/$noteId", params: { noteId: created.id } });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ noteId, isPinned }: { noteId: number; isPinned: boolean }) =>
      updateNote(noteId, { isPinned }),
    onSuccess: () => router.invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => router.invalidate(),
  });

  const handleDelete = (note: NoteSummary) => {
    deleteMutation.mutate(note.id);
    toast("Note deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          createNote({ title: note.title, content: "" }).then(() =>
            router.invalidate(),
          );
        },
      },
    });
  };

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

      <div className="space-y-0.5">
        {notes.length > 0 ? (
          notes.map((note) => (
            <div key={note.id} className="group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-muted/60">
              <Link
                to="/notes/$noteId"
                params={{ noteId: note.id }}
                className="flex min-w-0 flex-1 items-center gap-2 text-sm"
              >
                {note.isPinned && (
                  <PushPinIcon className="size-3 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate font-medium">
                  {note.title || "Untitled note"}
                </span>
              </Link>

              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() =>
                    pinMutation.mutate({
                      noteId: note.id,
                      isPinned: !note.isPinned,
                    })
                  }
                >
                  <PushPinIcon
                    className="size-3.5"
                    weight={note.isPinned ? "fill" : "regular"}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(note)}
                >
                  <TrashIcon className="size-3.5" />
                </Button>
              </div>

              <span className="shrink-0 pl-2 font-mono text-[11px] tracking-tighter text-muted-foreground">
                {formatDistanceToNowStrict(new Date(note.updatedAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
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
