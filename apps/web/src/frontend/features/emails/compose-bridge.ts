import type { Editor } from "@tiptap/core";

let activeEditor: Editor | null = null;

const openComposeListeners = new Set<
  (initial: { to?: string; subject?: string; body?: string }) => void
>();

export function registerComposeEditor(editor: Editor) {
  activeEditor = editor;
}

export function unregisterComposeEditor() {
  activeEditor = null;
}

export function getActiveComposeEditor(): Editor | null {
  return activeEditor;
}

export function insertComposeContent(html: string): boolean {
  if (activeEditor && !activeEditor.isDestroyed) {
    activeEditor.commands.insertContent(html);
    return true;
  }
  return false;
}

export function onOpenCompose(
  listener: (initial: {
    to?: string;
    subject?: string;
    body?: string;
  }) => void,
) {
  openComposeListeners.add(listener);
  return () => {
    openComposeListeners.delete(listener);
  };
}

export function openCompose(initial: {
  to?: string;
  subject?: string;
  body?: string;
}) {
  if (activeEditor && !activeEditor.isDestroyed && initial.body) {
    activeEditor.commands.setContent(initial.body);
    return;
  }
  for (const listener of openComposeListeners) {
    listener(initial);
  }
}
