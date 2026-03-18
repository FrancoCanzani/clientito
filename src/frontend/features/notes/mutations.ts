import type { Note } from "./types";

export async function createNote(input: {
  title?: string;
  content?: string;
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

export async function uploadNoteImage(
  file: File,
): Promise<{ key: string; url: string }> {
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
