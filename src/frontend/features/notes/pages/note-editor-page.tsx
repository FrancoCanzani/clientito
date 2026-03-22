import { Button } from "@/components/ui/button";
import { EditorHeader } from "@/features/notes/components/editor-header";
import { NoteBubbleMenu } from "@/features/notes/components/note-bubble-menu";
import { useNoteAutosave } from "@/features/notes/hooks/use-note-autosave";
import { useNoteEditor } from "@/features/notes/hooks/use-note-editor";
import { useSlashCommands } from "@/features/notes/hooks/use-slash-commands";
import { createNote, uploadNoteImage } from "@/features/notes/mutations";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import { RichTextProvider } from "reactjs-tiptap-editor";
import { SlashCommandList } from "reactjs-tiptap-editor/slashcommand";
import "reactjs-tiptap-editor/style.css";

const noteRouteApi = getRouteApi("/_dashboard/notes/$noteId");

export default function NoteEditorPage() {
  const { note } = noteRouteApi.useLoaderData();
  const navigate = noteRouteApi.useNavigate();

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

  const createNoteMutation = useMutation({
    mutationFn: async () =>
      createNote({
        title: "Untitled note",
        content: "",
      }),
    onSuccess: (created) => {
      navigate({
        to: "/notes/$noteId",
        params: { noteId: created.id },
      });
    },
  });

  useEffect(() => {
    reset(note.title, note.content);
    editor?.commands.setContent(note.content || "", { emitUpdate: false });
  }, [editor, note.content, note.id, note.title, reset]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-background py-2">
        <div className="min-w-0 flex-1">
          <EditorHeader
            title={title}
            onTitleChange={setTitle}
            isSaving={isSaving}
            saveState={saveState}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => createNoteMutation.mutate()}
          disabled={createNoteMutation.isPending}
        >
          {createNoteMutation.isPending ? "Creating..." : "New note"}
        </Button>
      </div>

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
