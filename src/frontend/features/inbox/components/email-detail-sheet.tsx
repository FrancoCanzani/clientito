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
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] overflow-hidden rounded-t-3xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{email.subject ?? "(no subject)"}</SheetTitle>
        </SheetHeader>
        <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border/80" />
        <EmailDetailContent key={email.id} email={email} />
      </SheetContent>
    </Sheet>
  );
}
