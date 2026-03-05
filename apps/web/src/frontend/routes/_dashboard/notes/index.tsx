import { fetchNotes } from "@/features/notes/api";
import NotesListPage from "@/features/notes/pages/notes-list-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/notes/")({
  loader: async () => {
    const response = await fetchNotes({
      scope: "canvas",
      limit: 200,
      offset: 0,
    });
    return { notes: response.data };
  },
  component: NotesListPage,
});
