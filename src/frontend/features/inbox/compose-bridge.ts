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
