import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EmailListItem } from "../types";
import type { ComposeInitial } from "./compose-email-dialog";
import { EmailDetailContent } from "./email-detail-content";

export function EmailDetailSheet({
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90%] overflow-hidden">
        <SheetHeader className="sr-only">
          <SheetTitle>{email.subject ?? "(no subject)"}</SheetTitle>
        </SheetHeader>
        <EmailDetailContent
          key={email.id}
          email={email}
          onForward={onForward}
        />
      </SheetContent>
    </Sheet>
  );
}
