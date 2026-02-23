import type { SdkRelease } from "@releaselayer/shared";
import { trackEvent } from "../api";
import { addDismissed } from "../storage";

export function renderModal(
  release: SdkRelease,
  root: ShadowRoot,
  endUserId: string,
  brandingEnabled: boolean
): void {
  const overlay = document.createElement("div");
  overlay.className = "rl-overlay";

  const modal = document.createElement("div");
  modal.className = "rl-modal";
  modal.style.position = "relative";

  const closeBtn = document.createElement("button");
  closeBtn.className = "rl-modal-close";
  closeBtn.innerHTML = "&#215;";
  closeBtn.onclick = () => dismiss();

  const header = document.createElement("div");
  header.className = "rl-modal-header";
  const title = document.createElement("div");
  title.className = "rl-modal-title";
  title.textContent = release.title;
  header.appendChild(title);

  const body = document.createElement("div");
  body.className = "rl-modal-body";
  body.innerHTML = release.contentHtml;

  modal.appendChild(closeBtn);
  modal.appendChild(header);
  modal.appendChild(body);

  if (brandingEnabled) {
    const branding = document.createElement("div");
    branding.className = "rl-branding";
    branding.innerHTML = 'Powered by <a href="https://releaselayer.app" target="_blank">ReleaseLayer</a>';
    modal.appendChild(branding);
  }

  overlay.appendChild(modal);
  root.appendChild(overlay);

  // Track view
  trackEvent({ type: "view", releaseId: release.id, endUserId });

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
  });

  function dismiss() {
    overlay.remove();
    if (release.showOnce) addDismissed(release.id);
    trackEvent({ type: "dismiss", releaseId: release.id, endUserId });
  }
}
