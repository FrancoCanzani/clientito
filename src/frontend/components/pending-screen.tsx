import { SpinnerGapIcon } from "@phosphor-icons/react";

export function PendingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <SpinnerGapIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
