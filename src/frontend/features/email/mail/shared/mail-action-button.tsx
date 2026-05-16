import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { shortcutKey } from "@/lib/shortcuts";

export function MailActionButton({
  label,
  shortcutId,
  onClick,
  disabled = false,
  type = "button",
  className,
}: {
  label: string;
  shortcutId: string;
  onClick: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const key = shortcutKey(shortcutId);
  return (
    <Button
      type={type}
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      <span>{label}</span>
      {key && <Kbd>{key}</Kbd>}
    </Button>
  );
}
