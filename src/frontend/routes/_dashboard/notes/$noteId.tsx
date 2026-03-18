import NoteEditorPage from "@/features/notes/pages/note-editor-page";
import { fetchNoteById } from "@/features/notes/queries";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const noteParamsSchema = z.object({
  noteId: z.coerce.number().int().positive(),
});

export const Route = createFileRoute("/_dashboard/notes/$noteId")({
  params: {
    parse: (rawParams) => noteParamsSchema.parse(rawParams),
    stringify: (params) => ({ noteId: String(params.noteId) }),
  },
  loader: async ({ params }) => {
    const note = await fetchNoteById(params.noteId);
    return { note };
  },
  component: NoteEditorPage,
});
