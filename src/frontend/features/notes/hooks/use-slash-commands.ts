import type { Editor } from "@tiptap/core";
import { useMemo } from "react";
import { renderCommandListDefault } from "reactjs-tiptap-editor/slashcommand";

const SLASH_ALLOWLIST = new Set([
  "heading1",
  "heading2",
  "heading3",
  "headingParagraph",
  "bulletList",
  "orderedList",
  "orderedlist",
  "image",
]);

const SLASH_LABELS: Record<string, string> = {
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  headingParagraph: "Body",
  bulletList: "Bulleted list",
  orderedList: "Numbered list",
  orderedlist: "Numbered list",
  image: "Image",
};

const SLASH_DESCRIPTIONS: Record<string, string> = {
  heading1: "Large section heading",
  heading2: "Medium section heading",
  heading3: "Small section heading",
  headingParagraph: "Start typing with plain text",
  bulletList: "Create a simple bulleted list",
  orderedList: "Create a list with numbering",
  orderedlist: "Create a list with numbering",
  image: "Upload an image",
};

export function useSlashCommands({
  onPickImage,
}: {
  onPickImage: (editor: Editor) => void | Promise<void>;
}) {
  return useMemo(
    () =>
      renderCommandListDefault({ t: (key: string) => key })
        .map((group) => ({
          ...group,
          title: group.name === "insert" ? "Insert" : "Format",
          commands: group.commands
            .filter((command) => SLASH_ALLOWLIST.has(command.name))
            .map((command) => ({
              ...command,
              label: SLASH_LABELS[command.name] ?? command.label,
              description:
                SLASH_DESCRIPTIONS[command.name] ?? command.description,
              action:
                command.name === "image"
                  ? ({ editor }: { editor: Editor }) => onPickImage(editor)
                  : command.action,
            })),
        }))
        .filter((group) => group.commands.length > 0),
    [onPickImage],
  );
}
