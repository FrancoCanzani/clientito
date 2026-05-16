import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type InlineImageUpload = (files: File[]) => Promise<
  Array<{
    src: string;
    key: string;
    contentId: string;
    filename: string;
    mimeType: string;
  }>
>;

export function createImagePasteExtension(uploadInlineImages: InlineImageUpload) {
  return Extension.create({
    name: "imagePaste",

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("imagePaste"),
          props: {
            handlePaste: (_view, event) => {
              const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
                file.type.startsWith("image/"),
              );
              if (files.length === 0) return false;

              event.preventDefault();
              void uploadInlineImages(files).then((images) => {
                for (const image of images) {
                  this.editor
                    .chain()
                    .focus()
                    .setImage({
                      src: image.src,
                      alt: image.filename,
                      title: image.filename,
                    })
                    .updateAttributes("imageResize", {
                      "data-inline-attachment-key": image.key,
                      "data-content-id": image.contentId,
                    })
                    .run();
                }
              });
              return true;
            },
          },
        }),
      ];
    },
  });
}
