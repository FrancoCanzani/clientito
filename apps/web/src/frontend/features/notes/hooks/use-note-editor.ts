import type { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import { ListItem } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { TextStyle } from "@tiptap/extension-text-style";
import {
  Dropcursor,
  Gapcursor,
  Placeholder,
  TrailingNode,
} from "@tiptap/extensions";
import { useEditor } from "@tiptap/react";
import { Bold } from "reactjs-tiptap-editor/bold";
import { BulletList } from "reactjs-tiptap-editor/bulletlist";
import { Heading } from "reactjs-tiptap-editor/heading";
import { Highlight } from "reactjs-tiptap-editor/highlight";
import { Image } from "reactjs-tiptap-editor/image";
import { Italic } from "reactjs-tiptap-editor/italic";
import { Link as LinkExtension } from "reactjs-tiptap-editor/link";
import { OrderedList } from "reactjs-tiptap-editor/orderedlist";
import { SlashCommand } from "reactjs-tiptap-editor/slashcommand";
import { Strike } from "reactjs-tiptap-editor/strike";

const YELLOW_HIGHLIGHT = "#fde047";

export function useNoteEditor({
  initialContent,
  onChange,
  onUploadImage,
}: {
  initialContent: string;
  onChange: (contentHtml: string) => void;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Text,
      Dropcursor,
      Gapcursor,
      HardBreak,
      Paragraph,
      TrailingNode,
      ListItem,
      Heading.configure({ levels: [1, 2, 3] }),
      BulletList,
      OrderedList,
      TextStyle,
      Bold,
      Italic,
      Strike,
      LinkExtension,
      Highlight.configure({
        multicolor: true,
        defaultColor: YELLOW_HIGHLIGHT,
      }),
      Image.configure({
        resourceImage: "upload",
        upload: onUploadImage,
      }),
      Placeholder.configure({
        placeholder: "Press '/' for commands",
      }),
      SlashCommand,
    ],
    content: initialContent,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "min-h-[70vh] text-sm outline-none",
      },
    },
  });

  return editor as Editor | null;
}
