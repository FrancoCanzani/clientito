import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CaretDownIcon, CheckIcon, LinkSimpleIcon } from "@phosphor-icons/react";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { Fragment, useCallback, useMemo, useState } from "react";
import {
  getComposeToolbarGroups,
  getHeadingLabel,
  HEADING_OPTIONS,
} from "./compose-toolbar-commands";

function ToolbarButton({
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
      onMouseDown={(event) => event.preventDefault()}
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

function normalizeLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function ComposeBubbleMenu({ editor }: { editor: Editor }) {
  const [linkInput, setLinkInput] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const openLinkPopover = useCallback(() => {
    const href = editor.getAttributes("link").href;
    const existing = typeof href === "string" ? href : "";
    setLinkInput(existing);
    setLinkPopoverOpen(true);
  }, [editor]);

  const toolbarGroups = useMemo(
    () => getComposeToolbarGroups({ onOpenLink: openLinkPopover }),
    [openLinkPopover],
  );

  const setLink = useCallback(() => {
    const normalized = normalizeLink(linkInput);
    if (!normalized) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: normalized })
        .run();
    }
    setLinkPopoverOpen(false);
  }, [editor, linkInput]);

  const currentLink =
    typeof editor.getAttributes("link").href === "string"
      ? (editor.getAttributes("link").href as string)
      : "";

  return (
    <BubbleMenu
      editor={editor}
      options={{}}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-0.5 shadow-md"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Headings"
          >
            {getHeadingLabel(editor)}
            <CaretDownIcon className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-32">
          {HEADING_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => {
                option.run(editor);
              }}
            >
              {option.label}
              {option.active(editor) && <CheckIcon className="ml-auto size-3" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="mx-0.5 h-4 w-px bg-border" />

      {toolbarGroups.map((group, groupIndex) => (
        <Fragment key={group.id}>
          {groupIndex > 0 && <span className="mx-0.5 h-4 w-px bg-border" />}
          {group.commands.map((command) => {
            const Icon = command.icon;
            const title = command.shortcut
              ? `${command.label} (${command.shortcut})`
              : command.label;
            const active = command.active?.(editor) ?? false;

            if (command.id === "link") {
              return (
                <Popover
                  key={command.id}
                  open={linkPopoverOpen}
                  onOpenChange={setLinkPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <ToolbarButton
                      active={active}
                      onClick={() => command.run(editor)}
                      title={title}
                    >
                      <Icon className="size-4" />
                    </ToolbarButton>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" className="w-64">
                    <div className="space-y-2">
                      <input
                        type="url"
                        value={linkInput}
                        onChange={(event) => setLinkInput(event.target.value)}
                        placeholder="https://example.com"
                        className="h-8 w-full rounded border border-input bg-transparent px-2 text-xs outline-none"
                        autoFocus
                      />
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          onClick={() => {
                            editor.chain().focus().unsetLink().run();
                            setLinkInput("");
                            setLinkPopoverOpen(false);
                          }}
                        >
                          Unlink
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => setLinkPopoverOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="rounded bg-foreground px-2 py-1 text-xs text-background transition-colors hover:opacity-90"
                            onClick={setLink}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                      {currentLink ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          onClick={() =>
                            window.open(currentLink, "_blank", "noopener,noreferrer")
                          }
                        >
                          <LinkSimpleIcon className="size-3" />
                          Open link
                        </button>
                      ) : null}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            return (
              <ToolbarButton
                key={command.id}
                active={active}
                onClick={() => command.run(editor)}
                title={title}
              >
                <Icon className="size-4" />
              </ToolbarButton>
            );
          })}
        </Fragment>
      ))}
    </BubbleMenu>
  );
}
