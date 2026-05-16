import { Extension } from "@tiptap/core";
import { toggleMark } from "@tiptap/pm/commands";
import { Plugin, PluginKey } from "@tiptap/pm/state";

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const EmailPasteHandler = Extension.create({
  name: "emailPasteHandler",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("emailPasteHandler"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain").trim();
            if (!text || !isUrl(text) || view.state.selection.empty) return false;

            const { state, dispatch } = view;
            toggleMark(this.editor.schema.marks.link, { href: text })(state, dispatch);
            event.preventDefault();
            return true;
          },
        },
      }),
    ];
  },
});
