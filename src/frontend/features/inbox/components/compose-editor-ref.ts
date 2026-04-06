import type { Editor } from "@tiptap/core";

let activeEditor: Editor | null = null;

export function registerComposeEditor(editor: Editor) {
  activeEditor = editor;
}

export function unregisterComposeEditor() {
  activeEditor = null;
}

export function getComposerBody(): string | null {
  if (!activeEditor) return null;
  return activeEditor.getText();
}

export function setComposerBody(html: string) {
  if (!activeEditor) return;
  activeEditor.commands.setContent(html);
}

export function isComposerOpen(): boolean {
  return activeEditor !== null;
}
