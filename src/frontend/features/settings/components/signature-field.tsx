import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export function SignatureField({
  mailboxId,
  initialSignature,
  isSaving,
  onSave,
}: {
  mailboxId: number | null;
  initialSignature: string;
  isSaving: boolean;
  onSave: (mailboxId: number, signature: string) => void;
}) {
  const [value, setValue] = useState(initialSignature);
  const isDirty = value !== initialSignature;

  if (mailboxId == null) return null;

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Signature</p>
        <p className="text-xs text-muted-foreground">
          Appended to outgoing emails.
        </p>
      </div>
      <div className="min-w-0 space-y-2 sm:max-w-[60%]">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your email signature..."
          rows={3}
          className="text-sm"
        />
        {isDirty && (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => onSave(mailboxId, value)}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
