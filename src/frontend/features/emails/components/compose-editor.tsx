import { EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import {
  registerComposeEditor,
  unregisterComposeEditor,
} from "../compose-bridge";
import { useComposeEditor } from "../hooks/use-compose-editor";
import { ComposeBubbleMenu } from "./compose-bubble-menu";

type ComposeEditorProps = {
  initialContent: string;
  onChange: (html: string) => void;
  onSend?: () => void;
  className?: string;
  autoFocus?: boolean;
};

export function ComposeEditor({
  initialContent,
  onChange,
  onSend,
  className,
  autoFocus,
}: ComposeEditorProps) {
  const editor = useComposeEditor({ initialContent, onChange });

  useEffect(() => {
    if (!editor) return;
    registerComposeEditor(editor);
    return () => unregisterComposeEditor();
  }, [editor]);

  useEffect(() => {
    if (autoFocus && editor) {
      setTimeout(() => editor.commands.focus(), 0);
    }
  }, [autoFocus, editor]);

  if (!editor) return null;

  return (
    <div
      className={className}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          onSend?.();
        }
      }}
    >
      <ComposeBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
