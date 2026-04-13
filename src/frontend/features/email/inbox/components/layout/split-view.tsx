import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useState } from "react";

export type SplitViewState = {
  enabled: boolean;
  selectedEmailId: string | null;
  select: (id: string | null) => void;
  toggle: () => void;
};

export function useSplitView(): SplitViewState {
  const isMobile = useIsMobile();
  const [enabled, setEnabled] = useState(!isMobile);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (prev) setSelectedEmailId(null);
      return !prev;
    });
  }, []);

  const select = useCallback(
    (id: string | null) => setSelectedEmailId(id),
    [],
  );

  return { enabled: !isMobile && enabled, selectedEmailId, select, toggle };
}

export function SplitViewLayout({
  list,
  detail,
}: {
  list: React.ReactNode;
  detail: React.ReactNode | null;
}) {
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel defaultSize={detail ? 42 : 100} minSize={28}>
        {list}
      </ResizablePanel>
      {detail && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={58} minSize={32}>
            <div className="h-full overflow-y-auto">{detail}</div>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
