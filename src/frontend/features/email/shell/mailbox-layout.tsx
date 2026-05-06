import type { ReactNode } from "react";
import { MailboxTopbar } from "./mailbox-topbar";
import { useMailboxHotkeys } from "./use-mailbox-hotkeys";

export function MailboxLayout({ children }: { children: ReactNode }) {
  useMailboxHotkeys();
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MailboxTopbar />
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
