import type { SdkInitResponse } from "@releaselayer/shared";
import { configure, fetchInit, flushEvents, trackEvent } from "./api";
import { createContainer, destroyContainer } from "./shadow";
import { getBaseStyles } from "./styles";
import { matchesTraits } from "./targeting";
import { getDismissed } from "./storage";
import { renderModal } from "./widgets/modal";
import { renderBanner } from "./widgets/banner";
import { renderChangelog } from "./widgets/changelog";

interface InitOptions {
  user?: {
    id: string;
    traits?: Record<string, unknown>;
  };
  host?: string;
}

let initialized = false;
let endUserId = "anon_" + Math.random().toString(36).slice(2, 10);
let userTraits: Record<string, unknown> | undefined;

function init(key: string, options?: InitOptions) {
  if (initialized) {
    console.warn("[ReleaseLayer] Already initialized");
    return;
  }

  if (!key) {
    console.error("[ReleaseLayer] SDK key is required");
    return;
  }

  initialized = true;
  configure(key, options?.host);

  if (options?.user?.id) endUserId = options.user.id;
  userTraits = options?.user?.traits;

  // Flush events on page unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushEvents();
  });
  window.addEventListener("pagehide", flushEvents);

  // Wait for DOM ready then load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
}

async function load() {
  const data = await fetchInit(endUserId, userTraits);
  if (!data) return;

  render(data);
}

function render(data: SdkInitResponse) {
  const { releases, config, checklist } = data;
  const dismissed = getDismissed();

  // Filter releases: match traits + not dismissed
  const visible = releases.filter((r) => {
    if (r.showOnce && dismissed.has(r.id)) return false;
    return matchesTraits(r.targetTraits, userTraits);
  });

  if (visible.length === 0 && !checklist) return;

  const root = createContainer(config.zIndex);

  // Inject styles
  const style = document.createElement("style");
  style.textContent = getBaseStyles(config.customCss);
  root.appendChild(style);

  // Separate by display type
  const modals = visible.filter((r) => r.displayType === "modal");
  const banners = visible.filter((r) => r.displayType === "banner");
  const changelogs = visible.filter((r) => r.displayType === "changelog");

  // Render banners (can show multiple)
  for (const banner of banners) {
    renderBanner(banner, root, endUserId, config.position);
  }

  // Render changelog feed if any
  if (changelogs.length > 0) {
    renderChangelog(changelogs, root, endUserId, config.brandingEnabled);
  }

  // Render first modal (one at a time)
  if (modals.length > 0) {
    renderModal(modals[0], root, endUserId, config.brandingEnabled);
  }
}

function identify(userId: string, traits?: Record<string, unknown>) {
  endUserId = userId;
  if (traits) userTraits = traits;
}

function track(event: string, data?: Record<string, unknown>) {
  trackEvent({
    type: "click",
    endUserId,
    data: { event, ...data },
  });
}

function destroy() {
  flushEvents();
  destroyContainer();
  initialized = false;
}

// Expose on globalThis
const ReleaseLayer = { init, identify, track, destroy };

declare global {
  interface Window {
    ReleaseLayer: typeof ReleaseLayer;
  }
}

const releaseLayerGlobal = globalThis as typeof globalThis & {
  ReleaseLayer: typeof ReleaseLayer;
};
releaseLayerGlobal.ReleaseLayer = ReleaseLayer;

export { init, identify, track, destroy };
export default ReleaseLayer;
