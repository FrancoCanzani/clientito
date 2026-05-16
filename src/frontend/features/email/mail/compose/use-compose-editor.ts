import { useEditor } from "@tiptap/react";
import { getEmailComposerExtensions } from "@/features/email/mail/compose/editor-preset";
import { sanitizePastedHtml } from "@/editor/utils/sanitize-pasted-html";
import type { InlineImageUpload } from "@/editor/extensions/image-paste";

export function useComposeEditor({
  initialContent,
  onChange,
  uploadInlineImages = async () => [],
}: {
  initialContent: string;
  onChange: (contentHtml: string) => void;
  uploadInlineImages?: InlineImageUpload;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: getEmailComposerExtensions(uploadInlineImages),
    content: initialContent,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
    editorProps: {
      transformPastedHTML: sanitizePastedHtml,
      attributes: {
        class: "min-h-[120px] text-[13px] outline-none max-w-none",
      },
    },
  });

  return editor;
}
