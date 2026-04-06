import type { EmailDetailItem } from "@/features/inbox/types";
import type { RefObject } from "react";
import { QuickReply, type QuickReplyHandle } from "./quick-reply";

export function EmailComposer({
  email,
  quickReplyRef,
}: {
  email: EmailDetailItem;
  quickReplyRef: RefObject<QuickReplyHandle | null>;
}) {
  return <QuickReply ref={quickReplyRef} email={email} detail={email} />;
}
