import { useHotkey } from "@tanstack/react-hotkeys";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { RichTextBold } from "reactjs-tiptap-editor/bold";
import {
  RichTextBubbleLink,
  RichTextBubbleText,
} from "reactjs-tiptap-editor/bubble";
import { RichTextBulletList } from "reactjs-tiptap-editor/bulletlist";
import { RichTextItalic } from "reactjs-tiptap-editor/italic";
import { RichTextLink } from "reactjs-tiptap-editor/link";
import { RichTextOrderedList } from "reactjs-tiptap-editor/orderedlist";
import { RichTextStrike } from "reactjs-tiptap-editor/strike";

const YELLOW_HIGHLIGHT = "#fde047";

export function NoteBubbleMenu({ editor }: { editor: Editor }) {
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const blockMenuRef = useRef<HTMLDivElement | null>(null);
  const blockMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  const setBlockType = useCallback(
    (value: "body" | "h1" | "h2" | "h3") => {
      if (value === "body") {
        editor.chain().focus().setParagraph().run();
        setIsBlockMenuOpen(false);
        return;
      }

      const level = Number(value.slice(1)) as 1 | 2 | 3;
      editor.chain().focus().setHeading({ level }).run();
      setIsBlockMenuOpen(false);
    },
    [editor],
  );

  const toggleYellowHighlight = useCallback(() => {
    const chain = editor.chain().focus();
    if (editor.isActive("highlight", { color: YELLOW_HIGHLIGHT })) {
      chain.unsetHighlight().run();
      return;
    }
    chain.setHighlight({ color: YELLOW_HIGHLIGHT }).run();
  }, [editor]);

  const blockValue: "body" | "h1" | "h2" | "h3" = editor.isActive("heading", {
    level: 1,
  })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "body";

  const blockLabel =
    blockValue === "h1"
      ? "Heading 1"
      : blockValue === "h2"
        ? "Heading 2"
        : blockValue === "h3"
          ? "Heading 3"
          : "Body";

  useEffect(() => {
    if (!isBlockMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (blockMenuRef.current?.contains(target)) return;
      setIsBlockMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [isBlockMenuOpen]);

  useHotkey(
    "Escape",
    () => {
      setIsBlockMenuOpen(false);
    },
    {
      enabled: isBlockMenuOpen,
      preventDefault: false,
      stopPropagation: false,
    },
  );

  return (
    <div>
      <RichTextBubbleText
        buttonBubble={
          <div
            className="notes-bubble-menu"
            onMouseDown={(event) => event.preventDefault()}
          >
            <div className="notes-block-picker" ref={blockMenuRef}>
              <button
                ref={blockMenuButtonRef}
                type="button"
                onClick={() => setIsBlockMenuOpen((prev) => !prev)}
              >
                {blockLabel}
              </button>
              {isBlockMenuOpen ? (
                <div className="notes-block-picker-menu">
                  <button type="button" onClick={() => setBlockType("body")}>
                    Body
                  </button>
                  <button type="button" onClick={() => setBlockType("h1")}>
                    Heading 1
                  </button>
                  <button type="button" onClick={() => setBlockType("h2")}>
                    Heading 2
                  </button>
                  <button type="button" onClick={() => setBlockType("h3")}>
                    Heading 3
                  </button>
                </div>
              ) : null}
            </div>

            <span className="notes-bubble-divider" />
            <RichTextBulletList />
            <RichTextOrderedList />
            <span className="notes-bubble-divider" />
            <RichTextLink />
            <RichTextBold />
            <RichTextItalic />
            <RichTextStrike />
            <button
              type="button"
              onClick={toggleYellowHighlight}
              data-state={
                editor.isActive("highlight", {
                  color: YELLOW_HIGHLIGHT,
                })
                  ? "on"
                  : "off"
              }
            >
              Yellow
            </button>
          </div>
        }
      />

      <RichTextBubbleLink />
    </div>
  );
}
