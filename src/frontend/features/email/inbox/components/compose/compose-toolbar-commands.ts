import {
  CodeBlockIcon,
  CodeIcon,
  EraserIcon,
  LinkSimpleIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextTIcon,
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

export type HeadingOption = {
  id: "paragraph" | "heading-1" | "heading-2";
  label: string;
  active: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

export const HEADING_OPTIONS: HeadingOption[] = [
  {
    id: "paragraph",
    label: "Text",
    active: (editor) => editor.isActive("paragraph"),
    run: (editor) => {
      editor.chain().focus().setParagraph().run();
    },
  },
  {
    id: "heading-1",
    label: "H1",
    active: (editor) => editor.isActive("heading", { level: 1 }),
    run: (editor) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
  },
  {
    id: "heading-2",
    label: "H2",
    active: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
  },
];

export function getHeadingLabel(editor: Editor): string {
  if (editor.isActive("heading", { level: 1 })) return "H1";
  if (editor.isActive("heading", { level: 2 })) return "H2";
  return "Text";
}

export function getComposeToolbarGroups({
  onOpenLink,
}: {
  onOpenLink: () => void;
}): ComposeToolbarGroup[] {
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
    {
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
            if (editor.isActive("codeBlock")) {
              editor.chain().focus().setParagraph().run();
              return;
            }
            editor.chain().focus().setCodeBlock().run();
          },
        },
      ],
    },
    {
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
    },
    {
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
    },
    {
      id: "cleanup",
      commands: [
        {
          id: "clear",
          label: "Clear formatting",
          icon: EraserIcon,
          run: (editor) => {
            editor.chain().focus().unsetAllMarks().clearNodes().run();
          },
        },
        {
          id: "paragraph",
          label: "Paragraph",
          icon: TextTIcon,
          run: (editor) => {
            editor.chain().focus().setParagraph().run();
          },
        },
      ],
    },
  ];
}
