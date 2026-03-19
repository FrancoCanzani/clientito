import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { sendEmail } from "../mutations";
import type { ComposeInitial } from "./compose-email-dialog";

type UseComposeEmailOptions = {
  onSent?: () => void;
};

function createComposeDraft(initial?: ComposeInitial) {
  return {
    to: initial?.to ?? "",
    cc: initial?.cc ?? "",
    subject: initial?.subject ?? "",
    body: initial?.body ?? "",
  };
}

export function getComposeInitialKey(initial?: ComposeInitial) {
  return [initial?.to ?? "", initial?.cc ?? "", initial?.subject ?? "", initial?.body ?? ""].join(
    "\u0001",
  );
}

export function useComposeEmail(
  initial?: ComposeInitial,
  options?: UseComposeEmailOptions,
) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => createComposeDraft(initial));
  const attachments = useAttachmentUpload();
  const bodyRef = useRef(draft.body);

  const { to, cc, subject, body } = draft;

  const setTo = (value: string) => {
    setDraft((current) => ({ ...current, to: value }));
  };

  const setCc = (value: string) => {
    setDraft((current) => ({ ...current, cc: value }));
  };

  const setSubject = (value: string) => {
    setDraft((current) => ({ ...current, subject: value }));
  };

  const setBody = (value: string) => {
    bodyRef.current = value;
    setDraft((current) => ({ ...current, body: value }));
  };

  const sendMutation = useMutation({
    mutationFn: () =>
      sendEmail({
        to,
        cc: cc.trim().length > 0 ? cc.trim() : undefined,
        subject,
        body: bodyRef.current,
        attachments:
          attachments.files.length > 0
            ? attachments.getAttachmentKeys()
            : undefined,
      }),
    onSuccess: () => {
      toast.success("Email sent");
      setDraft(createComposeDraft());
      attachments.clear();
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      options?.onSent?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const canSend = useMemo(() => {
    const hasBody =
      body.trim().length > 0 && body !== "<p></p>" && body !== "<p><br></p>";
    return (
      to.trim().length > 0 &&
      subject.trim().length > 0 &&
      hasBody &&
      !sendMutation.isPending
    );
  }, [body, sendMutation.isPending, subject, to]);

  return {
    to,
    setTo,
    cc,
    setCc,
    subject,
    setSubject,
    body,
    setBody,
    canSend,
    sendMutation,
    attachments,
  };
}
