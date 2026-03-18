import { and, eq, ne, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { notes } from "../../db/schema";

const NOTE_IMAGE_PATH = "/api/notes/image";
const SRC_ATTRIBUTE_REGEX = /\bsrc\s*=\s*(['"])(.*?)\1/gi;

function notesImagesBucket(env: Env): R2Bucket {
  return (env as Env & { NOTES_IMAGES: R2Bucket }).NOTES_IMAGES;
}

function imageKeyFromSrc(src: string, userId: string): string | null {
  try {
    const parsed = new URL(src, "https://notes.local");
    if (parsed.pathname !== NOTE_IMAGE_PATH) return null;

    const key = parsed.searchParams.get("key");
    if (!key || !key.startsWith(`${userId}/`)) return null;

    return key;
  } catch {
    return null;
  }
}

export function extractNoteImageKeys(content: string, userId: string): Set<string> {
  const keys = new Set<string>();
  for (const match of content.matchAll(SRC_ATTRIBUTE_REGEX)) {
    const src = match[2];
    if (!src) continue;

    const key = imageKeyFromSrc(src, userId);
    if (key) keys.add(key);
  }
  return keys;
}

async function isKeyReferencedByOtherNotes(input: {
  db: Database;
  userId: string;
  key: string;
  noteIdToExclude?: number;
}): Promise<boolean> {
  const { db, userId, key, noteIdToExclude } = input;
  const imageUrlNeedle = `${NOTE_IMAGE_PATH}?key=${encodeURIComponent(key)}`;

  let whereClause = and(
    eq(notes.userId, userId),
    sql<boolean>`instr(${notes.content}, ${imageUrlNeedle}) > 0`,
  );

  if (noteIdToExclude !== undefined) {
    whereClause = and(whereClause, ne(notes.id, noteIdToExclude));
  }

  const referenced = await db
    .select({ id: notes.id })
    .from(notes)
    .where(whereClause)
    .limit(1);

  return Boolean(referenced[0]);
}

export async function cleanupRemovedNoteImages(input: {
  db: Database;
  env: Env;
  userId: string;
  previousContent: string;
  nextContent: string;
  noteIdToExclude?: number;
}): Promise<void> {
  const { db, env, userId, previousContent, nextContent, noteIdToExclude } = input;

  const previousKeys = extractNoteImageKeys(previousContent, userId);
  if (previousKeys.size === 0) return;

  const nextKeys = extractNoteImageKeys(nextContent, userId);
  const removedKeys = [...previousKeys].filter((key) => !nextKeys.has(key));
  if (removedKeys.length === 0) return;

  const bucket = notesImagesBucket(env);

  for (const key of removedKeys) {
    const stillReferenced = await isKeyReferencedByOtherNotes({
      db,
      userId,
      key,
      noteIdToExclude,
    });
    if (stillReferenced) continue;

    try {
      await bucket.delete(key);
    } catch (error) {
      console.error("Failed to delete orphaned note image", { key, error });
    }
  }
}
