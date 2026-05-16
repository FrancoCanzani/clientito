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
import { Extension } from "@tiptap/core";
import { EmailPasteHandler } from "@/editor/extensions/email-paste-handler";
import {
  createImagePasteExtension,
  type InlineImageUpload,
} from "@/editor/extensions/image-paste";
import { SplitNearHardBreaks } from "@/editor/extensions/split-near-hard-breaks";
import { InlineImageResize } from "@/editor/extensions/inline-image-resize";

const ReserveSendShortcut = Extension.create({
  name: "reserveSendShortcut",
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => true,
    };
  },
});

export function getEmailComposerExtensions(uploadInlineImages: InlineImageUpload) {
  return [
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
    InlineImageResize.configure({
      minWidth: 80,
      maxWidth: 1200,
      HTMLAttributes: {
        inline: true,
      },
    }),
    Placeholder.configure({
      placeholder: "Write your message...",
    }),
    EmailPasteHandler,
    SplitNearHardBreaks,
    createImagePasteExtension(uploadInlineImages),
    ReserveSendShortcut,
  ];
}
