import { useCallback, useState } from "react";
import { uploadAttachments } from "@/features/email/mail/shared/mutations";

export type AttachmentFile = {
 key: string;
 filename: string;
 mimeType: string;
 size: number;
 disposition: "attachment" | "inline";
 contentId?: string;
};

export function useAttachmentUpload(initialFiles: AttachmentFile[] = []) {
 const [files, setFiles] = useState<AttachmentFile[]>(initialFiles);
 const [uploading, setUploading] = useState(false);

 const addFiles = useCallback(async (
 inputFiles: FileList | File[],
 disposition: "attachment" | "inline" = "attachment",
 ) => {
 setUploading(true);
 try {
 const result = await uploadAttachments(Array.from(inputFiles));
 const next = result.map((file) => ({
 ...file,
 disposition,
 ...(disposition === "inline"
 ? { contentId: `${crypto.randomUUID()}@petit.inline` }
 : {}),
 }));
 setFiles((prev) => [...prev, ...next]);
 return next;
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

 const replaceFiles = useCallback((nextFiles: AttachmentFile[]) => {
 setFiles(nextFiles);
 }, []);

 const getAttachmentKeys = useCallback(() => {
 return files.map((f) => ({
 key: f.key,
 filename: f.filename,
 mimeType: f.mimeType,
 size: f.size,
 disposition: f.disposition,
 contentId: f.contentId,
 }));
 }, [files]);

 return {
 files,
 uploading,
 addFiles,
 removeFile,
 clear,
 replaceFiles,
 getAttachmentKeys,
 };
}
