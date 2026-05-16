import { sanitizePastedHtml } from "@/editor/utils/sanitize-pasted-html";
import { useEditor } from "@tiptap/react";
import { getScratchpadExtensions } from "./editor-preset";

export function useScratchpadEditor({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (contentHtml: string) => void;
}) {
  return useEditor({
    immediatelyRender: false,
    extensions: getScratchpadExtensions(),
    content: initialContent,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      transformPastedHTML: sanitizePastedHtml,
      attributes: {
        class:
          "scratchpad-editor min-h-full text-[13px] leading-relaxed outline-none max-w-none",
      },
    },
  });
}
