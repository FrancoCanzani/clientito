import type { ReactNode } from "react";
import { MailboxSidebar } from "./mailbox-menu";
import { MailboxTopbar } from "./mailbox-topbar";
import { useDeltaSync } from "./use-delta-sync";
import { useMailboxHotkeys } from "./use-mailbox-hotkeys";
import { useViewPreload } from "./use-view-preload";

export function MailboxLayout({ children }: { children: ReactNode }) {
  useMailboxHotkeys();
  useDeltaSync();
  useViewPreload();
  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <MailboxSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MailboxTopbar />
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
