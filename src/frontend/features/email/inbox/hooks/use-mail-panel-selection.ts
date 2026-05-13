import { useCallback } from "react";

export function useMailPanelSelection({
  isMobile,
  emailId,
  onClear,
  onNavigate,
}: {
  isMobile: boolean;
  emailId?: string | null;
  onClear: () => void;
  onNavigate: (emailId: string) => void;
}) {
  const selectedEmailId = isMobile ? null : (emailId ?? null);
  const clearSelectedEmail = useCallback(() => {
    onClear();
  }, [onClear]);
  const navigateSelectedEmail = useCallback(
    (nextEmailId: string) => {
      onNavigate(nextEmailId);
    },
    [onNavigate],
  );

  return {
    selectedEmailId,
    enableKeyboardNavigation: !selectedEmailId,
    clearSelectedEmail,
    navigateSelectedEmail,
  };
}
