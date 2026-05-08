import { cn } from "@/lib/utils";
import { DotsThreeIcon } from "@phosphor-icons/react";
import type { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";
import { useComposeEditor } from "../hooks/use-compose-editor";
import {
 registerComposeEditor,
 unregisterComposeEditor,
} from "./compose-editor-ref";

type ComposeEditorProps = {
 initialContent: string;
 onChange: (html: string) => void;
 onSend?: () => void;
 className?: string;
 autoFocus?: boolean;
 isFocused?: boolean;
 onFocusField?: () => void;
 onEditorReady?: (editor: Editor | null) => void;
};

export function ComposeEditor({
 initialContent,
 onChange,
 onSend,
 className,
 autoFocus,
 isFocused,
 onFocusField,
 onEditorReady,
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
 onEditorReady?.(editor);
 return () => onEditorReady?.(null);
 }, [editor, onEditorReady]);

 useEffect(() => {
 if (!editor) return;
 registerComposeEditor(editor);
 return () => unregisterComposeEditor(editor);
 }, [editor]);

 useEffect(() => {
 if (!editor) return;
 const next = initialContent?.trim() ? initialContent : "<p></p>";
 if (editor.getHTML() === next) return;
 editor.commands.setContent(next, { emitUpdate: false });
 }, [editor, initialContent]);

 useEffect(() => {
 if (!autoFocus || !editor) return;
 const timer = setTimeout(() => editor.commands.focus(), 0);
 return () => clearTimeout(timer);
 }, [autoFocus, editor]);

 useEffect(() => {
 if (!isFocused || !editor) return;
 const timer = setTimeout(() => editor.commands.focus(), 0);
 return () => clearTimeout(timer);
 }, [editor, isFocused]);

 useEffect(() => {
 if (!editor || !onFocusField) return;
 const handleFocus = () => onFocusField();
 editor.on("focus", handleFocus);
 return () => {
 editor.off("focus", handleFocus);
 };
 }, [editor, onFocusField]);

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
 className={cn("compose-editor", className)}
 onClick={() => onFocusField?.()}
 onKeyDown={(e) => {
 if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
 e.preventDefault();
 onSend?.();
 }
 }}
 >
 {hasForwardedContent && (
 <button
 type="button"
 className="mb-2 inline-flex items-center gap-1.5 px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
