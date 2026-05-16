import { EditorContent } from "@tiptap/react";
import { useScratchpadEditor } from "./use-scratchpad-editor";

export function ScratchpadEditor({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (contentHtml: string) => void;
}) {
  const editor = useScratchpadEditor({ initialContent, onChange });
  if (!editor) return null;

  return <EditorContent className="h-full" editor={editor} />;
}
