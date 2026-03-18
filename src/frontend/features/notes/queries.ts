import type { Note, NotesListResponse } from "./types";

export async function fetchNotes(params?: {
  limit?: number;
  offset?: number;
}): Promise<NotesListResponse> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));

  const response = await fetch(`/api/notes?${query.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch notes");
  return response.json();
}

export async function fetchNoteById(noteId: number): Promise<Note> {
  const response = await fetch(`/api/notes/${noteId}`);
  if (!response.ok) throw new Error("Failed to fetch note");
  const json = await response.json();
  return json.data;
}
