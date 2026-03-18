export function shouldIgnoreHotkeyTarget(target: EventTarget | null) {
  const element =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  if (!element) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  return Boolean(
    element.closest(
      "input, textarea, [role='textbox'], [cmdk-root], [data-slot='dialog-content'] textarea",
    ),
  );
}
