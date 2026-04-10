import { useLogout } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { MoonIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";
import { useMemo } from "react";
import { paletteIcon } from "../registry/palette-icon";
import type { Command } from "../registry/types";

export function useActionCommands(): Command[] {
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();
  const logout = useLogout();

  return useMemo(
    (): Command[] => [
      {
        id: "action:toggle-theme",
        label: () =>
          resolvedTheme === "dark"
            ? "Switch to Light Mode"
            : "Switch to Dark Mode",
        icon: paletteIcon(resolvedTheme === "dark" ? SunIcon : MoonIcon),
        group: "actions",
        perform: (_ctx, services) => {
          toggleTheme();
          services.close();
        },
      },
      {
        id: "action:sign-out",
        label: "Sign out",
        icon: paletteIcon(SignOutIcon),
        group: "actions",
        perform: () => {
          logout.mutate();
        },
      },
    ],
    [resolvedTheme, toggleTheme, logout],
  );
}
