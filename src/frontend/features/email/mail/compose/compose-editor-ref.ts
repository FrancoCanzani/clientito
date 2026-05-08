import type { Editor } from "@tiptap/core";
import { escapeHtml } from "../utils/escape-html";

let activeEditor: Editor | null = null;

export function registerComposeEditor(editor: Editor) {
 activeEditor = editor;
}

export function unregisterComposeEditor(editor?: Editor) {
 if (!editor) {
 activeEditor = null;
 return;
 }

 // Prevent stale unmount cleanups from clearing a newer composer instance.
 if (activeEditor === editor) {
 activeEditor = null;
 }
}

export function getComposerBody(): string | null {
 if (!activeEditor) return null;
 return activeEditor.getText();
}

export function plainTextToHtml(text: string): string {
 return text
 .split(/\n{2,}/)
 .map(
 (paragraph) =>
 `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>") || "<br>"}</p>`,
 )
 .join("");
}

export function setComposerBody(text: string) {
 if (!activeEditor) return;
 activeEditor.commands.setContent(plainTextToHtml(text));
}

export function isComposerOpen(): boolean {
 return activeEditor !== null;
}

export function getComposerEditor(): Editor | null {
 return activeEditor;
}

export function getComposerSelection(): string | null {
 if (!activeEditor) return null;
 const { from, to } = activeEditor.state.selection;
 if (from === to) return null;
 return activeEditor.state.doc.textBetween(from, to);
}
