import { Button } from "@/components/ui/button";
import { EmailThread } from "@/features/email/mail/thread/email-thread";
import type {
  EmailDetailItem,
  EmailThreadItem,
} from "@/features/email/mail/types";

export function TodoReaderPanel({
  currentEmail,
  threadMessages,
  hasDetailError,
  onRetry,
  hasThreadError,
}: {
  currentEmail: EmailDetailItem | null;
  threadMessages: EmailThreadItem[];
  hasDetailError: boolean;
  hasThreadError: boolean;
  onRetry: () => void;
}) {
  if (hasDetailError) {
    return (
      <section className="min-h-0 flex-1 overflow-hidden rounded border border-border/40 bg-background">
        <div className="flex h-full items-center justify-center px-6 text-center">
          <div className="space-y-3">
            <p className="text-sm font-medium">Unable to open email</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (!currentEmail) {
    return (
      <section className="min-h-0 flex-1 overflow-hidden rounded border border-border/40 bg-background">
        <div className="h-full" />
      </section>
    );
  }

  return (
    <section className="min-h-0 flex-1 overflow-hidden rounded border border-border/40 bg-background">
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
          <EmailThread
            email={currentEmail}
            threadMessages={threadMessages}
            threadError={hasThreadError}
            readingMode="detox"
          />
        </div>
      </div>
    </section>
  );
}
