import { z } from "zod";

export const preferencesSchema = z.object({
  font: z.enum(["sans", "serif", "mono"]).default("sans"),
  fontSize: z.enum(["sm", "base", "lg", "xl"]).default("base"),
  warmth: z.enum(["auto", "on", "off"]).default("off"),
  showImages: z.enum(["never", "ask", "always"]).default("ask"),
  showQuoted: z.enum(["collapsed", "expanded"]).default("collapsed"),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const defaultPreferences: Preferences = preferencesSchema.parse({});

export const readingPresets: Record<"detox" | "standard", Preferences> = {
  detox: {
    font: "serif",
    fontSize: "base",
    warmth: "auto",
    showImages: "ask",
    showQuoted: "collapsed",
  },
  standard: {
    font: "sans",
    fontSize: "base",
    warmth: "off",
    showImages: "always",
    showQuoted: "collapsed",
  },
};
