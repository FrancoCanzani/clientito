import type { SdkRelease } from "@releaselayer/shared";
import { trackEvent } from "../api";
import { addDismissed } from "../storage";

export function renderBanner(
  release: SdkRelease,
  root: ShadowRoot,
  endUserId: string,
  position: string
): void {
  const banner = document.createElement("div");
  banner.className = `rl-banner ${position.includes("top") ? "rl-banner-top" : "rl-banner-bottom"}`;

  const text = document.createElement("span");
  text.innerHTML = release.contentHtml;

  const closeBtn = document.createElement("button");
  closeBtn.className = "rl-banner-close";
  closeBtn.innerHTML = "&#215;";
  closeBtn.onclick = () => {
    banner.remove();
    if (release.showOnce) addDismissed(release.id);
    trackEvent({ type: "dismiss", releaseId: release.id, endUserId });
  };

  banner.appendChild(text);
  banner.appendChild(closeBtn);
  root.appendChild(banner);

  trackEvent({ type: "view", releaseId: release.id, endUserId });
}
