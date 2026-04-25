import { ComposeDockedToolbar } from "@/features/email/inbox/components/compose/compose-docked-toolbar";
import { useComposeEditor } from "@/features/email/inbox/hooks/use-compose-editor";
import { cn } from "@/lib/utils";
import { EditorContent } from "@tiptap/react";
import { useEffect } from "react";

type RichTextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function RichTextField({
  value,
  onChange,
  className,
}: RichTextFieldProps) {
  const editor = useComposeEditor({
    initialContent: value || "<p></p>",
    onChange,
  });

  useEffect(() => {
    if (!editor) return;
    const next = value?.trim() ? value : "<p></p>";
    if (editor.getHTML() === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-border/70 bg-background focus-within:border-foreground/30",
        className,
      )}
    >
      <ComposeDockedToolbar
        editor={editor}
        className="mx-0 mb-0 border-b border-t-0 px-2"
      />
      <div className="min-h-36 px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
