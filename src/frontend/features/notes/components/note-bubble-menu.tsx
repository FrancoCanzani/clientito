import { cn } from "@/lib/utils";
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
const bubbleMenuClassName = cn(
  "relative inline-flex items-center gap-[0.2rem] overflow-visible rounded-full border border-[#1f2430] bg-[#161a22] px-[0.34rem] py-[0.28rem] text-[#f3f4f6] shadow-[0_10px_24px_rgba(0,0,0,0.25)]",
  "[&_button]:h-[1.9rem] [&_button]:min-w-[1.9rem] [&_button]:rounded-lg [&_button]:border-0 [&_button]:text-[#e5e7eb] [&_button]:transition-[background-color,color,transform] [&_button]:duration-150 [&_button]:ease-out [&_button:hover]:bg-white/10 [&_button:active]:scale-[0.98]",
  "[&_button[data-state=on]]:bg-white/16 [&_button[data-state=on]]:text-white",
);

const blockPickerMenuClassName = cn(
  "absolute left-0 top-[calc(100%+0.35rem)] z-40 min-w-36 rounded-[0.6rem] border border-[#2a3140] bg-[#10151e] p-1 shadow-[0_10px_24px_rgba(0,0,0,0.32)]",
  "[&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:justify-start [&_button]:rounded-md [&_button]:px-2 [&_button]:text-left [&_button]:text-sm [&_button]:leading-none",
);

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
            role="toolbar"
            aria-label="Text formatting"
            className={bubbleMenuClassName}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div className="relative" ref={blockMenuRef}>
              <button
                ref={blockMenuButtonRef}
                type="button"
                onClick={() => setIsBlockMenuOpen((prev) => !prev)}
                className="px-[0.55rem] text-[0.95rem] leading-none text-slate-300"
              >
                {blockLabel}
              </button>
              {isBlockMenuOpen ? (
                <div className={blockPickerMenuClassName}>
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

            <span className="h-[1.15rem] w-px bg-white/18" />
            <RichTextBulletList />
            <RichTextOrderedList />
            <span className="h-[1.15rem] w-px bg-white/18" />
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
              className="px-[0.55rem] text-[0.85rem] leading-none"
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
