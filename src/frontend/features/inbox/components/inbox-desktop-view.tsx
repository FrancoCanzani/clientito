import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useEmail } from "@/features/inbox/context/email-context";
import { EmailDetailPanel } from "./email-detail-panel";
import { EmailList } from "./email-list";

export function InboxDesktopView() {
  const { selectedEmail } = useEmail();

  if (!selectedEmail) {
    return <EmailList />;
  }

  return (
    <div className="-mt-4 -mb-24 h-dvh w-full min-w-0 overflow-hidden">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel
          defaultSize="46%"
          minSize="30%"
          maxSize="62%"
          className="min-w-0 overflow-hidden"
        >
          <EmailList />
        </ResizablePanel>
        <ResizableHandle className="bg-border/70" />
        <ResizablePanel
          defaultSize="54%"
          minSize="40%"
          className="min-w-0 overflow-hidden"
        >
          <EmailDetailPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
