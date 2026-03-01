import type { NavigationCommand } from "../types";

const NAV_TAG_RE = /<nav\s+([^>]*?)\/>/g;
const ATTR_RE = /(\w+)="([^"]*)"/g;

export function parseNavigationBlock(
  content: string,
): NavigationCommand | null {
  NAV_TAG_RE.lastIndex = 0;
  const match = NAV_TAG_RE.exec(content);
  if (!match?.[1]) return null;

  const attrs: Record<string, string> = {};
  let attrMatch: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((attrMatch = ATTR_RE.exec(match[1])) !== null) {
    attrs[attrMatch[1]] = attrMatch[2];
  }

  if (!attrs.path) return null;

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key !== "path" && value) {
      params[key] = value;
    }
  }

  return {
    action: "navigate",
    path: attrs.path,
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

export function stripNavigationBlocks(content: string): string {
  return content.replace(NAV_TAG_RE, "").trim();
}
