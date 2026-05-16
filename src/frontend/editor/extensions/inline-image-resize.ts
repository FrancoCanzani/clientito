import ImageResize from "tiptap-extension-resize-image";

export const InlineImageResize = ImageResize.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-inline-attachment-key": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-inline-attachment-key"),
      },
      "data-content-id": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-content-id"),
      },
    };
  },
});
