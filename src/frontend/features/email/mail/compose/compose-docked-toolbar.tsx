import {
 Popover,
 PopoverAnchor,
 PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { getComposeToolbarGroups } from "./compose-toolbar-commands";
import {
 HeadingSelect,
 LinkEditor,
 ToolbarButton,
} from "./compose-toolbar-shared";
import { normalizeLink } from "./compose-toolbar-utils";

export function ComposeDockedToolbar({
 editor,
 className,
}: {
 editor: Editor | null;
 className?: string;
}) {
 const [linkInput, setLinkInput] = useState("");
 const [linkOpen, setLinkOpen] = useState(false);
 const savedRangeRef = useRef<{ from: number; to: number } | null>(null);

 const state = useEditorState({
 editor,
 selector: ({ editor: e }) => {
 if (!e) return null;
 return {
 hasSelection: e.state.selection.from !== e.state.selection.to,
 linkActive: e.isActive("link"),
 storage: JSON.stringify({
 bold: e.isActive("bold"),
 italic: e.isActive("italic"),
 strike: e.isActive("strike"),
 code: e.isActive("code"),
 blockquote: e.isActive("blockquote"),
 codeBlock: e.isActive("codeBlock"),
 bulletList: e.isActive("bulletList"),
 orderedList: e.isActive("orderedList"),
 link: e.isActive("link"),
 }),
 };
 },
 });

 const openLink = useCallback(() => {
 if (!editor) return;
 const { from, to } = editor.state.selection;
 savedRangeRef.current = { from, to };
 const href = editor.getAttributes("link").href;
 setLinkInput(typeof href === "string" ? href : "");
 setLinkOpen(true);
 }, [editor]);

 const toolbarGroups = useMemo(
 () =>
 editor ? getComposeToolbarGroups({ editor, onOpenLink: openLink }) : [],
 [editor, openLink],
 );

 const applyLink = useCallback(() => {
 if (!editor) return;
 const range = savedRangeRef.current;
 const normalized = normalizeLink(linkInput);
 const chain = editor.chain().focus();
 if (range) chain.setTextSelection(range);
 if (!normalized) {
 chain.extendMarkRange("link").unsetLink().run();
 } else {
 chain.extendMarkRange("link").setLink({ href: normalized }).run();
 }
 savedRangeRef.current = null;
 setLinkOpen(false);
 }, [editor, linkInput]);

 const unsetLink = useCallback(() => {
 if (!editor) return;
 const range = savedRangeRef.current;
 const chain = editor.chain().focus();
 if (range) chain.setTextSelection(range);
 chain.extendMarkRange("link").unsetLink().run();
 savedRangeRef.current = null;
 setLinkInput("");
 setLinkOpen(false);
 }, [editor]);

 const currentLink =
 editor && typeof editor.getAttributes("link").href === "string"
 ? (editor.getAttributes("link").href as string)
 : "";

 if (!editor) return null;

 const canLink =
 (state?.hasSelection ?? false) || (state?.linkActive ?? false);

 return (
 <div
 className={cn(
 "-mx-2 mb-1 flex flex-wrap items-center gap-0.5 border-t border-border/50 px-2 py-1",
 className,
 )}
 >
 <HeadingSelect editor={editor} />
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
 open={linkOpen}
 onOpenChange={setLinkOpen}
 >
 <PopoverAnchor asChild>
 <ToolbarButton
 active={active}
 disabled={!canLink}
 onClick={() => command.run(editor)}
 title={canLink ? title : "Select text to add a link"}
 >
 <Icon className="size-4" />
 </ToolbarButton>
 </PopoverAnchor>
 <PopoverContent
 side="top"
 align="start"
 className="w-auto p-0"
 onOpenAutoFocus={(event) => event.preventDefault()}
 >
 <LinkEditor
 value={linkInput}
 onChange={setLinkInput}
 onSubmit={applyLink}
 onCancel={() => setLinkOpen(false)}
 onUnlink={unsetLink}
 currentLink={currentLink}
 />
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
 </div>
 );
}
