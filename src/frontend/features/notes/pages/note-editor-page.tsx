import { EditorHeader } from "@/features/notes/components/editor-header";
import { NoteBubbleMenu } from "@/features/notes/components/note-bubble-menu";
import { useNoteAutosave } from "@/features/notes/hooks/use-note-autosave";
import { useNoteEditor } from "@/features/notes/hooks/use-note-editor";
import { useSlashCommands } from "@/features/notes/hooks/use-slash-commands";
import { uploadNoteImage } from "@/features/notes/mutations";
import { getRouteApi } from "@tanstack/react-router";
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
    <div className="space-y-6 max-w-2xl mx-auto">
      <EditorHeader
        title={title}
        onTitleChange={setTitle}
        isSaving={isSaving}
        saveState={saveState}
      />

      {editor ? (
        <RichTextProvider editor={editor}>
          <NoteBubbleMenu editor={editor} />
          <SlashCommandList commandList={slashCommandList} />
          <EditorContent editor={editor} />
        </RichTextProvider>
      ) : null}
    </div>
  );
}
