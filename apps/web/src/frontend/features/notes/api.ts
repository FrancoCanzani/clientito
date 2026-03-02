import type { Note } from "./types";

export async function createNote(input: {
  content: string;
  personId?: number;
  companyId?: number;
}): Promise<Note> {
  const response = await fetch("/api/notes", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Failed to create note");
  const json = await response.json();
  return json.data;
}

export async function deleteNote(noteId: number): Promise<void> {
  const response = await fetch(`/api/notes/${noteId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to delete note");
}
