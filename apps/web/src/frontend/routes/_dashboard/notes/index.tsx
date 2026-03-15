import NotesListPage from "@/features/notes/pages/notes-list-page";
import { fetchNotes } from "@/features/notes/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/notes/")({
  loader: async () => {
    const response = await fetchNotes({
      limit: 60,
      offset: 0,
    });
    return { notes: response.data };
  },
  component: NotesListPage,
});
