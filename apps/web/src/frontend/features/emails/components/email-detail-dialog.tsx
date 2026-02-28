import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmailListItem } from "../api";
import { EmailDetailContent } from "./email-detail-content";

export function EmailDetailDialog({
  orgId,
  email,
  open,
  onOpenChange,
}: {
  orgId: string;
  email: EmailListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!email) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] w-[94vw] overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="wrap-break-word font-medium leading-snug">
            {email.subject ?? "(no subject)"}
          </DialogTitle>
        </DialogHeader>
        <EmailDetailContent orgId={orgId} email={email} />
      </DialogContent>
    </Dialog>
  );
}
