import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    splitNearHardBreaks: {
      splitNearHardBreaks: () => ReturnType;
    };
  }
}

export const SplitNearHardBreaks = Extension.create({
  name: "splitNearHardBreaks",

  addCommands() {
    return {
      splitNearHardBreaks:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from, $to } = state.selection;
          let previous: { from: number; to: number } | undefined;
          let next: { from: number; to: number } | undefined;

          $from.parent.descendants((child, offset) => {
            if (next) return false;
            if (child.type.name !== "hardBreak") return;

            const from = $from.start() + offset;
            const to = from + child.nodeSize;
            if (from < $from.pos) previous = { from, to };
            else if (to >= $to.pos) {
              next = { from, to };
              return false;
            }
          });

          if (!dispatch) return false;

          let from = $from.pos;
          let to = $to.pos;
          if (previous) {
            tr.delete(previous.from, previous.to);
            const splitPos = tr.mapping.map(previous.from);
            tr.split(splitPos);
            from = splitPos + 1;
          }
          if (next) {
            const nextFrom = tr.mapping.map(next.from);
            const nextTo = tr.mapping.map(next.to);
            tr.delete(nextFrom, nextTo);
            const splitPos = tr.mapping.map(nextFrom);
            tr.split(splitPos);
            to = splitPos;
          }

          if (!previous && !next) return false;
          tr.setSelection(TextSelection.between(tr.doc.resolve(from), tr.doc.resolve(to)));
          return true;
        },
    };
  },
});
