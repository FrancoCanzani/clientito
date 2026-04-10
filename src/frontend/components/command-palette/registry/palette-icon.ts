import React from "react";

export function paletteIcon(Icon: React.ComponentType<{ className?: string }>) {
  return React.createElement(Icon, { className: "size-4" });
}
