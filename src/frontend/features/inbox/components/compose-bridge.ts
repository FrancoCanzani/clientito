import type { Editor } from "@tiptap/core";
import type { ComposeInitial } from "../types";

let activeEditor: Editor | null = null;

const openComposeListeners = new Set<(initial: ComposeInitial) => void>();

export function registerComposeEditor(editor: Editor) {
  activeEditor = editor;
}

export function unregisterComposeEditor() {
  activeEditor = null;
}

export function registerOpenComposeListener(
  listener: (initial: ComposeInitial) => void,
) {
  openComposeListeners.add(listener);
  return () => {
    openComposeListeners.delete(listener);
  };
}

export function openCompose(initial: ComposeInitial) {
  for (const listener of openComposeListeners) {
    listener(initial);
  }
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
