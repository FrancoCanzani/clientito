import { Extension } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import { ListItem } from "@tiptap/extension-list";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Strike from "@tiptap/extension-strike";
import Text from "@tiptap/extension-text";
import { Dropcursor, Gapcursor, Placeholder } from "@tiptap/extensions";
import { useEditor } from "@tiptap/react";
import DOMPurify from "dompurify";
import ImageResize from "tiptap-extension-resize-image";

function sanitizePastedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style", "class", "id", "onclick", "onload", "onerror"],
  });
}

const ReserveSendShortcut = Extension.create({
  name: "reserveSendShortcut",
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => true,
    };
  },
});

export function useComposeEditor({
  initialContent,
  onChange,
}: {
  initialContent: string;
  onChange: (contentHtml: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Text,
      HardBreak,
      Paragraph,
      Dropcursor,
      Gapcursor,
      ListItem,
      BulletList,
      OrderedList,
      Blockquote,
      Heading.configure({ levels: [1, 2] }),
      Bold,
      Italic,
      Strike,
      Code,
      CodeBlock,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      ImageResize.configure({
        minWidth: 80,
        maxWidth: 1200,
      }),
      Placeholder.configure({
        placeholder: "Write your message...",
      }),
      ReserveSendShortcut,
    ],
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
