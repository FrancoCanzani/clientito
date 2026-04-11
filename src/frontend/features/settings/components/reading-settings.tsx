import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  setPreferences,
  usePreferences,
} from "@/features/settings/hooks/use-preferences";
import {
  readingPresets,
  type Preferences,
} from "@/features/settings/schema";

type Option<K extends keyof Preferences> = {
  value: Preferences[K];
  label: string;
};

const fontOptions: Option<"font">[] = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

const fontSizeOptions: Option<"fontSize">[] = [
  { value: "sm", label: "S" },
  { value: "base", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

const readingModeOptions: Option<"readingMode">[] = [
  { value: "detox", label: "Detox" },
  { value: "original", label: "Original" },
];

const warmthOptions: Option<"warmth">[] = [
  { value: "off", label: "Off" },
  { value: "auto", label: "Auto" },
  { value: "on", label: "On" },
];

const imagesOptions: Option<"showImages">[] = [
  { value: "never", label: "Never" },
  { value: "ask", label: "Ask" },
  { value: "always", label: "Always" },
];

function matchesPreset(prefs: Preferences, preset: Preferences): boolean {
  return (Object.keys(preset) as Array<keyof Preferences>).every(
    (key) => prefs[key] === preset[key],
  );
}

function updatePreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
): void {
  setPreferences({ [key]: value } as Pick<Preferences, K>);
}

function Row<K extends keyof Preferences>({
  title,
  description,
  settingKey,
  options,
}: {
  title: string;
  description?: string;
  settingKey: K;
  options: Option<K>[];
}) {
  const prefs = usePreferences();
  const current = prefs[settingKey];
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0 sm:max-w-[60%]">
        <ButtonGroup className="w-full sm:w-auto">
          {options.map((option) => (
            <Button
              key={String(option.value)}
              type="button"
              size="sm"
              variant={current === option.value ? "default" : "outline"}
              onClick={() => updatePreference(settingKey, option.value)}
            >
              {option.label}
            </Button>
          ))}
        </ButtonGroup>
      </div>
    </div>
  );
}

export function ReadingSettings() {
  const prefs = usePreferences();
  const activePreset = matchesPreset(prefs, readingPresets.detox)
    ? "detox"
    : matchesPreset(prefs, readingPresets.standard)
      ? "standard"
      : "custom";

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Reading
        </h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          Typography and distraction controls for the reading surface.
        </p>
      </div>
      <div className="border-t border-border/60">
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Preset</p>
            <p className="text-xs text-muted-foreground">
              {activePreset === "custom"
                ? "Custom configuration"
                : "Quick presets"}
            </p>
          </div>
          <div className="min-w-0 sm:max-w-[60%]">
            <ButtonGroup className="w-full sm:w-auto">
              <Button
                type="button"
                size="sm"
                variant={activePreset === "detox" ? "default" : "outline"}
                onClick={() => setPreferences(readingPresets.detox)}
              >
                Detox
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activePreset === "standard" ? "default" : "outline"}
                onClick={() => setPreferences(readingPresets.standard)}
              >
                Standard
              </Button>
            </ButtonGroup>
          </div>
        </div>
        <div className="border-t border-border/60" />
        <Row
          title="Font"
          description="Typeface for the dashboard and email bodies."
          settingKey="font"
          options={fontOptions}
        />
        <div className="border-t border-border/60" />
        <Row
          title="Font size"
          description="Applies to email bodies."
          settingKey="fontSize"
          options={fontSizeOptions}
        />
        <div className="border-t border-border/60" />
        <Row
          title="Reading mode"
          description="Detox strips styling. Original preserves sender design."
          settingKey="readingMode"
          options={readingModeOptions}
        />
        <div className="border-t border-border/60" />
        <Row
          title="Warmth"
          description="Subtle warm tint. Auto enables it after sunset."
          settingKey="warmth"
          options={warmthOptions}
        />
        <div className="border-t border-border/60" />
        <Row
          title="Remote images"
          description="Load sender-hosted images automatically."
          settingKey="showImages"
          options={imagesOptions}
        />
      </div>
    </section>
  );
}
