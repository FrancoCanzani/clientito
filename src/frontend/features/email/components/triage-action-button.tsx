import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

export function TriageActionButton({
  label,
  shortcut,
  onClick,
  disabled = false,
  type = "button",
  className,
}: {
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
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
      <Kbd>{shortcut}</Kbd>
    </Button>
  );
}
