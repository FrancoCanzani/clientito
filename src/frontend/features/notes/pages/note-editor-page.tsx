import { Button } from "@/components/ui/button";
import { EditorHeader } from "@/features/notes/components/editor-header";
import { NoteBubbleMenu } from "@/features/notes/components/note-bubble-menu";
import { useNoteAutosave } from "@/features/notes/hooks/use-note-autosave";
import { useNoteEditor } from "@/features/notes/hooks/use-note-editor";
import { useSlashCommands } from "@/features/notes/hooks/use-slash-commands";
import { uploadNoteImage } from "@/features/notes/mutations";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import { RichTextProvider } from "reactjs-tiptap-editor";
import { SlashCommandList } from "reactjs-tiptap-editor/slashcommand";
import "reactjs-tiptap-editor/style.css";

const noteRouteApi = getRouteApi("/_dashboard/notes/$noteId");

export default function NoteEditorPage() {
  const { note } = noteRouteApi.useLoaderData();

  const {
    title,
    setTitle,
    saveState,
    isSaving,
    queueSave,
    reset,
    pickAndInsertImage,
  } = useNoteAutosave({
    noteId: note.id,
    initialTitle: note.title,
    initialContent: note.content,
  });

  const editor = useNoteEditor({
    initialContent: note.content || "",
    onChange: (html) => queueSave(html),
    onUploadImage: async (file) => {
      const uploaded = await uploadNoteImage(file);
      return uploaded.url;
    },
  });

  const slashCommandList = useSlashCommands({
    onPickImage: (ed) => pickAndInsertImage(ed),
  });

  useEffect(() => {
    reset(note.title, note.content);
    editor?.commands.setContent(note.content || "", { emitUpdate: false });
  }, [editor, note.content, note.id, note.title, reset]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-background py-2">
        <Link to="/notes">
          <Button variant="ghost" size="icon" className="size-7">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <span className="text-xs text-muted-foreground">
          {isSaving
            ? "Saving..."
            : saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Save failed"
                : ""}
        </span>
      </div>

      <EditorHeader title={title} onTitleChange={setTitle} />

      <div className="mt-4">
      {editor ? (
        <RichTextProvider editor={editor}>
          <NoteBubbleMenu editor={editor} />
          <SlashCommandList commandList={slashCommandList} />
          <EditorContent editor={editor} />
        </RichTextProvider>
      ) : null}
      </div>
    </div>
  );
}
