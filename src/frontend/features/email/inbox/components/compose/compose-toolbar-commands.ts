import {
  CodeBlockIcon,
  CodeIcon,
  LinkSimpleIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
} from "@phosphor-icons/react";
import type { Editor } from "@tiptap/core";
import type { ComponentType } from "react";

type ToolbarIcon = ComponentType<{ className?: string }>;

export type ComposeToolbarCommand = {
  id: string;
  label: string;
  shortcut?: string;
  icon: ToolbarIcon;
  active?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

export type ComposeToolbarGroup = {
  id: string;
  commands: ComposeToolbarCommand[];
};

function insertIf<T>(cond: unknown, ...items: T[]): T[] {
  return cond ? items : [];
}

export function getComposeToolbarGroups({
  editor,
  onOpenLink,
}: {
  editor: Editor;
  onOpenLink: () => void;
}): ComposeToolbarGroup[] {
  const insideLink = editor.isActive("link");
  const insideCodeBlock = editor.isActive("codeBlock");

  return [
    {
      id: "marks",
      commands: [
        {
          id: "bold",
          label: "Bold",
          shortcut: "⌘B",
          icon: TextBIcon,
          active: (editor) => editor.isActive("bold"),
          run: (editor) => {
            editor.chain().focus().toggleBold().run();
          },
        },
        {
          id: "italic",
          label: "Italic",
          shortcut: "⌘I",
          icon: TextItalicIcon,
          active: (editor) => editor.isActive("italic"),
          run: (editor) => {
            editor.chain().focus().toggleItalic().run();
          },
        },
        {
          id: "strike",
          label: "Strikethrough",
          shortcut: "⌘⇧X",
          icon: TextStrikethroughIcon,
          active: (editor) => editor.isActive("strike"),
          run: (editor) => {
            editor.chain().focus().toggleStrike().run();
          },
        },
        {
          id: "inline-code",
          label: "Inline code",
          shortcut: "⌘E",
          icon: CodeIcon,
          active: (editor) => editor.isActive("code"),
          run: (editor) => {
            editor.chain().focus().toggleCode().run();
          },
        },
      ],
    },
    ...insertIf<ComposeToolbarGroup>(!insideCodeBlock, {
      id: "blocks",
      commands: [
        {
          id: "blockquote",
          label: "Quote",
          icon: QuotesIcon,
          active: (editor) => editor.isActive("blockquote"),
          run: (editor) => {
            editor.chain().focus().toggleBlockquote().run();
          },
        },
        {
          id: "code-block",
          label: "Code block",
          icon: CodeBlockIcon,
          active: (editor) => editor.isActive("codeBlock"),
          run: (editor) => {
            editor.chain().focus().toggleCodeBlock().run();
          },
        },
      ],
    }),
    ...insertIf<ComposeToolbarGroup>(!insideCodeBlock, {
      id: "lists",
      commands: [
        {
          id: "bullet-list",
          label: "Bullet list",
          shortcut: "⌘⇧8",
          icon: ListBulletsIcon,
          active: (editor) => editor.isActive("bulletList"),
          run: (editor) => {
            editor.chain().focus().toggleBulletList().run();
          },
        },
        {
          id: "ordered-list",
          label: "Numbered list",
          shortcut: "⌘⇧7",
          icon: ListNumbersIcon,
          active: (editor) => editor.isActive("orderedList"),
          run: (editor) => {
            editor.chain().focus().toggleOrderedList().run();
          },
        },
      ],
    }),
    ...insertIf<ComposeToolbarGroup>(!insideLink && !insideCodeBlock, {
      id: "links",
      commands: [
        {
          id: "link",
          label: "Link",
          shortcut: "⌘K",
          icon: LinkSimpleIcon,
          active: (editor) => editor.isActive("link"),
          run: () => {
            onOpenLink();
          },
        },
      ],
    }),
  ];
}
