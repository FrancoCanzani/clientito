import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import { ListItem } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Dropcursor, Gapcursor, Placeholder } from "@tiptap/extensions";
import { useEditor } from "@tiptap/react";
import { Bold } from "reactjs-tiptap-editor/bold";
import { BulletList } from "reactjs-tiptap-editor/bulletlist";
import { Image } from "reactjs-tiptap-editor/image";
import { Italic } from "reactjs-tiptap-editor/italic";
import { Link as LinkExtension } from "reactjs-tiptap-editor/link";
import { OrderedList } from "reactjs-tiptap-editor/orderedlist";
import { Strike } from "reactjs-tiptap-editor/strike";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read file as data URL"));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useComposeEditor({
  initialContent,
  onChange,
  onUploadImage,
}: {
  initialContent: string;
  onChange: (contentHtml: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
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
      Bold,
      Italic,
      Strike,
      LinkExtension,
      Image.configure({
        resourceImage: "upload",
        upload: onUploadImage ?? fileToDataUrl,
      }),
      Placeholder.configure({
        placeholder: "Write your message...",
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[120px] text-[13px] outline-none max-w-none",
      },
    },
  });

  return editor;
}
