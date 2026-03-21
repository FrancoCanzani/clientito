import { updateNote, uploadNoteImage } from "@/features/notes/mutations";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

export function useNoteAutosave({
  noteId,
  initialTitle,
  initialContent,
}: {
  noteId: number;
  initialTitle?: string;
  initialContent?: string;
}) {
  const [title, setTitleState] = useState(initialTitle || "Untitled note");
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">(
    "idle",
  );

  const titleRef = useRef(title);
  const lastContentRef = useRef(initialContent || "");
  const currentNoteIdRef = useRef(noteId);
  const latestIssuedSaveIdRef = useRef(0);
  const savedStateTimeoutRef = useRef<number | null>(null);
  const lastSavedRef = useRef({
    title: initialTitle || "Untitled note",
    content: initialContent || "",
  });

  const updateNoteMutation = useMutation({
    mutationFn: (variables: {
      noteId: number;
      saveId: number;
      nextTitle: string;
      nextContent: string;
    }) =>
      updateNote(variables.noteId, {
        title: variables.nextTitle,
        content: variables.nextContent,
      }),
    onMutate: () => {
      setSaveState("idle");
      if (savedStateTimeoutRef.current !== null)
        window.clearTimeout(savedStateTimeoutRef.current);
    },
    onSuccess: (updated, variables) => {
      if (
        variables.noteId !== currentNoteIdRef.current ||
        variables.saveId !== latestIssuedSaveIdRef.current
      ) {
        return;
      }

      lastSavedRef.current = {
        title: updated.title || "Untitled note",
        content: updated.content || "",
      };

      setSaveState("saved");
      savedStateTimeoutRef.current = window.setTimeout(() => {
        setSaveState("idle");
      }, 1200);
    },
    onError: (_, variables) => {
      if (
        variables.noteId !== currentNoteIdRef.current ||
        variables.saveId !== latestIssuedSaveIdRef.current
      ) {
        return;
      }
      setSaveState("error");
    },
  });

  const debouncedSave = useDebouncedCallback(
    (nextTitle: string, nextContent: string) => {
      const normalizedTitle = nextTitle.trim() || "Untitled note";

      if (
        normalizedTitle === lastSavedRef.current.title &&
        nextContent === lastSavedRef.current.content
      ) {
        return;
      }

      const saveId = latestIssuedSaveIdRef.current + 1;
      latestIssuedSaveIdRef.current = saveId;

      updateNoteMutation.mutate({
        noteId: currentNoteIdRef.current,
        saveId,
        nextTitle: normalizedTitle,
        nextContent,
      });
    },
    450,
  );

  const queueSave = useCallback(
    (contentHtml: string) => {
      lastContentRef.current = contentHtml;
      debouncedSave(titleRef.current, contentHtml);
    },
    [debouncedSave],
  );

  const setTitle = useCallback(
    (nextTitle: string) => {
      setTitleState(nextTitle);
      titleRef.current = nextTitle;
      debouncedSave(nextTitle, lastContentRef.current);
    },
    [debouncedSave],
  );

  const reset = useCallback((nextTitle?: string, nextContent?: string) => {
    const resolvedTitle = nextTitle || "Untitled note";
    const resolvedContent = nextContent || "";

    setTitleState(resolvedTitle);
    titleRef.current = resolvedTitle;
    lastContentRef.current = resolvedContent;

    latestIssuedSaveIdRef.current = 0;
    setSaveState("idle");

    if (savedStateTimeoutRef.current !== null)
      window.clearTimeout(savedStateTimeoutRef.current);

    lastSavedRef.current = {
      title: resolvedTitle,
      content: resolvedContent,
    };
  }, []);

  const pickAndInsertImage = useCallback(async (editor: Editor) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    const file = await new Promise<File | null>((resolve) => {
      input.onchange = () => {
        const selected = input.files?.[0] ?? null;
        input.onchange = null;
        input.remove();
        resolve(selected);
      };
      input.click();
    });

    if (!file) return;

    try {
      const uploaded = await uploadNoteImage(file);
      editor
        .chain()
        .focus()
        .setImageInline({ src: uploaded.url, alt: file.name })
        .run();
    } catch {
      toast.error("Failed to upload image");
    }
  }, []);

  useEffect(() => {
    currentNoteIdRef.current = noteId;
    latestIssuedSaveIdRef.current = 0;
    debouncedSave.cancel();

    if (savedStateTimeoutRef.current !== null) {
      window.clearTimeout(savedStateTimeoutRef.current);
      savedStateTimeoutRef.current = null;
    }
  }, [debouncedSave, noteId]);

  useEffect(() => {
    return () => {
      debouncedSave.flush();
      if (savedStateTimeoutRef.current !== null)
        window.clearTimeout(savedStateTimeoutRef.current);
    };
  }, [debouncedSave]);

  return {
    title,
    setTitle,
    saveState,
    isSaving: updateNoteMutation.isPending,
    queueSave,
    reset,
    pickAndInsertImage,
  };
}
