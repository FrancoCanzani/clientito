import type { ReactNode } from "react";
import { MailboxSidebar } from "./mailbox-sidebar";
import { useDeltaSync } from "./use-delta-sync";
import { useDocumentTitle } from "./use-document-title";
import { useMailboxHotkeys } from "./use-mailbox-hotkeys";
import { useViewPreload } from "./use-view-preload";

export function MailboxLayout({ children }: { children: ReactNode }) {
  useMailboxHotkeys();
  useDeltaSync();
  useDocumentTitle();
  useViewPreload();

  return (
    <div className="flex h-full scrollbar-gutter-stable scrollbar-thin scrollbar-thumb-sky-900 scrollbar-track-sky-100 min-h-0 flex-1 overflow-hidden">
      <MailboxSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
