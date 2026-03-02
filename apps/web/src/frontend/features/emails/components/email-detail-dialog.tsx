import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmailListItem } from "../types";
import { EmailDetailContent } from "./email-detail-content";

export function EmailDetailDialog({
  email,
  open,
  onOpenChange,
}: {
  email: EmailListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!email) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] w-[94vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="wrap-break-word font-medium leading-snug">
            {email.subject ?? "(no subject)"}
          </DialogTitle>
        </DialogHeader>
        <EmailDetailContent key={email.id} email={email} />
      </DialogContent>
    </Dialog>
  );
}
