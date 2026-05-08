import { Button } from "@/components/ui/button";
import { EmailThread } from "@/features/email/mail/thread/email-thread";
import type {
 EmailDetailItem,
 EmailThreadItem,
} from "@/features/email/mail/types";
import { cn } from "@/lib/utils";

export function TodoReaderPanel({
 currentEmail,
 threadMessages,
 hasDetailError,
 onRetry,
 hasThreadError,
 className,
}: {
 currentEmail: EmailDetailItem | null;
 threadMessages: EmailThreadItem[];
 hasDetailError: boolean;
 hasThreadError: boolean;
 onRetry: () => void;
 className?: string;
}) {
 const sectionClassName = cn(
 "min-h-0 flex-1 overflow-hidden border border-border/40 bg-background",
 className,
 );

 if (hasDetailError) {
 return (
 <section className={sectionClassName}>
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
 <section className={sectionClassName}>
 <div className="h-full" />
 </section>
 );
 }

 return (
 <section className={sectionClassName}>
 <div className="h-full min-h-0 overflow-y-auto">
 <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
 <EmailThread
 email={currentEmail}
 threadMessages={threadMessages}
 threadError={hasThreadError}
 />
 </div>
 </div>
 </section>
 );
}
