import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useTheme } from "@/hooks/use-theme";
import { MonitorIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";

const themeOptions = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-xs font-medium">Theme</p>
        <p className="text-xs text-muted-foreground">
          Choose how Duomo looks.
        </p>
      </div>
      <ButtonGroup className="w-full sm:w-auto">
        {themeOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={theme === option.value ? "default" : "outline"}
            onClick={() => setTheme(option.value)}
          >
            <option.icon className="size-3.5" />
            {option.label}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
}
