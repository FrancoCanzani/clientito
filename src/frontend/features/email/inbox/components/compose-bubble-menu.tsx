import {
  LinkSimpleIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
} from "@phosphor-icons/react";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { useCallback, useState } from "react";

function ToggleButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded p-1 transition-colors ${
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function ComposeBubbleMenu({ editor }: { editor: Editor }) {
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const setLink = useCallback(() => {
    const url = linkInput.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setShowLinkInput(false);
    setLinkInput("");
  }, [editor, linkInput]);

  const openLinkInput = useCallback(() => {
    const href = editor.getAttributes("link").href;
    const existing = typeof href === "string" ? href : undefined;
    setLinkInput(existing ?? "");
    setShowLinkInput(true);
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      options={{}}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-0.5 shadow-md"
    >
      {showLinkInput ? (
        <form
          action={() => {
            setLink();
          }}
          className="flex items-center gap-1"
        >
          <input
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="https://..."
            className="h-6 w-40 rounded border border-input bg-transparent px-1.5 text-xs outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="rounded px-1.5 py-0.5 text-xs text-foreground hover:bg-muted"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <ToggleButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <TextBIcon className="size-4" />
          </ToggleButton>
          <ToggleButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <TextItalicIcon className="size-4" />
          </ToggleButton>
          <ToggleButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <TextStrikethroughIcon className="size-4" />
          </ToggleButton>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <ToggleButton
            active={editor.isActive("link")}
            onClick={openLinkInput}
            title="Link"
          >
            <LinkSimpleIcon className="size-4" />
          </ToggleButton>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <ToggleButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <ListBulletsIcon className="size-4" />
          </ToggleButton>
          <ToggleButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Ordered list"
          >
            <ListNumbersIcon className="size-4" />
          </ToggleButton>
        </>
      )}
    </BubbleMenu>
  );
}
