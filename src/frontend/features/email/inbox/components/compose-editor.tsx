import { cn } from "@/lib/utils";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { EditorContent } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";
import { useComposeEditor } from "../hooks/use-compose-editor";
import {
  registerComposeEditor,
  unregisterComposeEditor,
} from "./compose-editor-ref";
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
  const [showForwardedContent, setShowForwardedContent] = useState(false);
  const hasForwardedContent = useMemo(
    () =>
      (editor?.getHTML() ?? initialContent).includes(
        "data-forwarded-original-body",
      ),
    [editor, initialContent],
  );

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

  useEffect(() => {
    if (!hasForwardedContent) {
      setShowForwardedContent(false);
    }
  }, [hasForwardedContent]);

  if (!editor) return null;

  return (
    <div
      role="group"
      aria-label="Message editor"
      className={className}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          onSend?.();
        }
      }}
    >
      <ComposeBubbleMenu editor={editor} />
      {hasForwardedContent && (
        <button
          type="button"
          className="mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setShowForwardedContent((current) => !current)}
        >
          <DotsThreeIcon className="size-3" weight="bold" />
          {showForwardedContent
            ? "Hide original message"
            : "Show original message"}
        </button>
      )}
      <div
        className={cn(
          hasForwardedContent &&
            !showForwardedContent &&
            "**:data-forwarded-original-body:hidden",
        )}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
