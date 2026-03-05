import type { Note, NotesListResponse } from "./types";

export async function fetchNotes(params?: {
  scope?: "all" | "canvas" | "linked";
  limit?: number;
  offset?: number;
}): Promise<NotesListResponse> {
  const query = new URLSearchParams();
  if (params?.scope) query.set("scope", params.scope);
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

export async function createNote(input: {
  title?: string;
  content?: string;
  personId?: number;
  companyId?: number;
}): Promise<Note> {
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Failed to create note");
  const json = await response.json();
  return json.data;
}

export async function updateNote(
  noteId: number,
  input: { title?: string; content?: string },
): Promise<Note> {
  const response = await fetch(`/api/notes/${noteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Failed to update note");
  const json = await response.json();
  return json.data;
}

export async function uploadNoteImage(file: File): Promise<{ key: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/notes/image", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload note image");
  const json = await response.json();
  return json.data;
}

export async function deleteNote(noteId: number): Promise<void> {
  const response = await fetch(`/api/notes/${noteId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete note");
}
