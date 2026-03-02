import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EmailListItem } from "../types";
import { EmailDetailContent } from "./email-detail-content";

export function EmailDetailSheet({
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90%] overflow-hidden">
        <SheetHeader>
          <SheetTitle className="text-lg font-medium">
            {email.subject ?? "(no subject)"}
          </SheetTitle>
        </SheetHeader>
        <EmailDetailContent key={email.id} email={email} />
      </SheetContent>
    </Sheet>
  );
}
