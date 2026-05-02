import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LinkSimpleIcon } from "@phosphor-icons/react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useEffect, useRef } from "react";

type ToolbarButtonProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
};

export function ToolbarButton({
  active,
  onClick,
  children,
  title,
  disabled,
  ref,
}: ToolbarButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`rounded p-1 text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-foreground/10" : "enabled:hover:bg-foreground/5"
      }`}
    >
      {children}
    </button>
  );
}

export function normalizeLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

type HeadingValue = "p" | "h1" | "h2";

export function HeadingSelect({ editor }: { editor: Editor }) {
  const value = useEditorState({
    editor,
    selector: ({ editor: e }): HeadingValue => {
      if (e.isActive("heading", { level: 1 })) return "h1";
      if (e.isActive("heading", { level: 2 })) return "h2";
      return "p";
    },
  });

  const onChange = (next: HeadingValue) => {
    const chain = editor.chain().focus();
    if (next === "p") chain.setParagraph().run();
    else if (next === "h1") chain.setHeading({ level: 1 }).run();
    else chain.setHeading({ level: 2 }).run();
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        onMouseDown={(event) => event.preventDefault()}
        className="h-7 w-[88px] border-none bg-transparent px-2 text-xs shadow-none hover:bg-foreground/5 focus-visible:ring-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="p">Text</SelectItem>
        <SelectItem value="h1">Heading 1</SelectItem>
        <SelectItem value="h2">Heading 2</SelectItem>
      </SelectContent>
    </Select>
  );
}

type LinkEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onUnlink: () => void;
  currentLink: string;
  autoFocus?: boolean;
};

export function LinkEditor({
  value,
  onChange,
  onSubmit,
  onCancel,
  onUnlink,
  currentLink,
  autoFocus = true,
}: LinkEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [autoFocus]);

  return (
    <div className="flex items-center gap-1 p-0.5">
      <LinkSimpleIcon className="mx-1 size-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        placeholder="https://example.com"
        className="h-7 w-56 rounded bg-transparent px-1 text-xs text-foreground outline-none"
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSubmit}
        className="rounded px-2 py-1 text-xs text-foreground transition-colors hover:bg-foreground/5"
      >
        Apply
      </button>
      {currentLink ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onUnlink}
          className="rounded px-2 py-1 text-xs text-foreground transition-colors hover:bg-foreground/5"
        >
          Unlink
        </button>
      ) : null}
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCancel}
        className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/5"
      >
        Cancel
      </button>
    </div>
  );
}
