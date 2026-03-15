import { useCallback, useState } from "react";
import { uploadAttachments } from "../mutations";

export type AttachmentFile = {
  key: string;
  filename: string;
  mimeType: string;
  size: number;
};

export function useAttachmentUpload() {
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback(async (inputFiles: FileList | File[]) => {
    setUploading(true);
    try {
      const result = await uploadAttachments(Array.from(inputFiles));
      setFiles((prev) => [...prev, ...result]);
    } finally {
      setUploading(false);
    }
  }, []);

  const removeFile = useCallback((key: string) => {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }, []);

  const clear = useCallback(() => {
    setFiles([]);
  }, []);

  const getAttachmentKeys = useCallback(() => {
    return files.map((f) => ({
      key: f.key,
      filename: f.filename,
      mimeType: f.mimeType,
    }));
  }, [files]);

  return {
    files,
    uploading,
    addFiles,
    removeFile,
    clear,
    getAttachmentKeys,
  };
}
