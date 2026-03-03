import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmailListItem } from "../types";
import type { ComposeInitial } from "./compose-email-dialog";
import { EmailDetailContent } from "./email-detail-content";

export function EmailDetailDialog({
  email,
  open,
  onOpenChange,
  onForward,
}: {
  email: EmailListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onForward?: (initial: ComposeInitial) => void;
}) {
  if (!email) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] w-[94vw] overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="wrap-break-word max-w-[95%] font-medium">
            {email.subject ?? "(no subject)"}
          </DialogTitle>
        </DialogHeader>
        <EmailDetailContent
          key={email.id}
          email={email}
          onClose={() => onOpenChange(false)}
          onForward={onForward}
        />
      </DialogContent>
    </Dialog>
  );
}
