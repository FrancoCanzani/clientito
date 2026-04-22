import { useEffect, useMemo, useState } from "react";
import { useAccountCommands } from "../commands/account-commands";
import { useActionCommands } from "../commands/action-commands";
import { getCommands } from "./registry";
import type { Command } from "./types";
import { useCommandContext } from "./use-command-context";

let commandModulesLoaded = false;
let commandModulesPromise: Promise<void> | null = null;

function loadCommandModules(): Promise<void> {
  if (commandModulesLoaded) {
    return Promise.resolve();
  }
  if (!commandModulesPromise) {
    commandModulesPromise = Promise.all([
      import("../commands/navigation-commands"),
      import("../commands/email-commands"),
      import("../commands/compose-commands"),
      import("../commands/composer-commands"),
    ]).then(() => {
      commandModulesLoaded = true;
    });
  }
  return commandModulesPromise;
}

export function useAllCommands(enabled: boolean): {
  commands: Command[];
  ctx: ReturnType<typeof useCommandContext>;
} {
  const ctx = useCommandContext();
  const [modulesReady, setModulesReady] = useState(commandModulesLoaded);

  useEffect(() => {
    if (!enabled || modulesReady) return;
    let active = true;
    void loadCommandModules().then(() => {
      if (active) {
        setModulesReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [enabled, modulesReady]);

  const staticCommands = useMemo(
    () => (modulesReady ? getCommands(ctx) : []),
    [ctx, modulesReady],
  );
  const accountCommands = useAccountCommands(ctx);
  const actionCommands = useActionCommands();

  const commands = useMemo(
    () => [...staticCommands, ...accountCommands, ...actionCommands],
    [staticCommands, accountCommands, actionCommands],
  );

  return { commands, ctx };
}
