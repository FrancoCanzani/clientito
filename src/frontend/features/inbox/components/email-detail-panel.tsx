import { Button } from "@/components/ui/button";
import { useEmail } from "@/features/inbox/context/email-context";
import { useEmailInboxKeyboard } from "@/features/inbox/hooks/use-email-inbox-keyboard";
import { CaretDownIcon, CaretUpIcon, XIcon } from "@phosphor-icons/react";
import { EmailDetailContent } from "./email-detail-content";

export function EmailDetailPanel() {
  const {
    selectedEmail,
    orderedIds,
    selectedEmailId,
    emailById,
    openEmail,
    closeEmail,
  } = useEmail();

  const { goToEmail, hasPrev, hasNext } = useEmailInboxKeyboard({
    orderedIds,
    selectedEmailId,
    emailById,
    openEmail,
  });

  if (!selectedEmail) return null;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border/70 bg-background">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 lg:px-8">
        <EmailDetailContent
          key={selectedEmail.id}
          email={selectedEmail}
          onClose={closeEmail}
          headerActions={
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                disabled={!hasPrev}
                onClick={() => goToEmail("prev")}
                title="Previous"
              >
                <CaretUpIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                disabled={!hasNext}
                onClick={() => goToEmail("next")}
                title="Next"
              >
                <CaretDownIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={closeEmail}
                title="Close"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}
