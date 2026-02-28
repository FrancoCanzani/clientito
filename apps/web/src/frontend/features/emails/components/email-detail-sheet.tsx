import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EmailListItem } from "../api";
import { EmailDetailContent } from "./email-detail-content";

export function EmailDetailSheet({
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-hidden p-0">
        <SheetHeader>
          <SheetTitle className="px-4 pt-5 text-lg font-medium">
            {email.subject ?? "(no subject)"}
          </SheetTitle>
        </SheetHeader>
        <EmailDetailContent orgId={orgId} email={email} />
      </SheetContent>
    </Sheet>
  );
}
