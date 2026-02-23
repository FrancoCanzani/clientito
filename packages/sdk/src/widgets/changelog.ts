import type { SdkRelease } from "@releaselayer/shared";
import { trackEvent } from "../api";
import { addDismissed } from "../storage";

export function renderChangelog(
  releases: SdkRelease[],
  root: ShadowRoot,
  endUserId: string,
  brandingEnabled: boolean
): void {
  const container = document.createElement("div");
  container.className = "rl-changelog";

  const header = document.createElement("div");
  header.className = "rl-changelog-header";

  const title = document.createElement("div");
  title.className = "rl-changelog-title";
  title.textContent = "What's New";

  const closeBtn = document.createElement("button");
  closeBtn.className = "rl-modal-close";
  closeBtn.innerHTML = "&#215;";
  closeBtn.style.position = "static";
  closeBtn.onclick = () => {
    container.remove();
    releases.forEach((r) => {
      if (r.showOnce) addDismissed(r.id);
      trackEvent({ type: "dismiss", releaseId: r.id, endUserId });
    });
  };

  header.appendChild(title);
  header.appendChild(closeBtn);
  container.appendChild(header);

  for (const release of releases) {
    const item = document.createElement("div");
    item.className = "rl-changelog-item";

    const itemTitle = document.createElement("div");
    itemTitle.className = "rl-changelog-item-title";
    itemTitle.textContent = release.title;

    const itemBody = document.createElement("div");
    itemBody.className = "rl-changelog-item-body";
    itemBody.innerHTML = release.contentHtml;

    const itemDate = document.createElement("div");
    itemDate.className = "rl-changelog-item-date";
    itemDate.textContent = new Date(release.publishedAt * 1000).toLocaleDateString();

    item.appendChild(itemTitle);
    item.appendChild(itemBody);
    item.appendChild(itemDate);
    container.appendChild(item);

    trackEvent({ type: "view", releaseId: release.id, endUserId });
  }

  if (brandingEnabled) {
    const branding = document.createElement("div");
    branding.className = "rl-branding";
    branding.innerHTML = 'Powered by <a href="https://releaselayer.app" target="_blank">ReleaseLayer</a>';
    container.appendChild(branding);
  }

  root.appendChild(container);
}
