let container: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;

export function createContainer(zIndex: number): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  container = document.createElement("div");
  container.id = "releaselayer-root";
  container.style.position = "fixed";
  container.style.zIndex = String(zIndex);
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "visible";

  shadowRoot = container.attachShadow({ mode: "open" });
  document.body.appendChild(container);

  return shadowRoot;
}

export function getShadowRoot(): ShadowRoot | null {
  return shadowRoot;
}

export function destroyContainer(): void {
  if (container) {
    container.remove();
    container = null;
    shadowRoot = null;
  }
}
