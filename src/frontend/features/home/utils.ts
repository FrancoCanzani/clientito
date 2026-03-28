export type BriefingSegment =
  | { type: "text"; value: string }
  | { type: "link"; title: string; href: string };

export function parseBriefingSegments(text: string): BriefingSegment[] {
  // Normalize: ensure space before [[ and after ]] (but not before punctuation)
  const normalized = text
    .replace(/(\S)\[\[/g, "$1 [[")
    .replace(/\]\]([^\s.,;:!?\)])/g, "]] $1");

  const segments: BriefingSegment[] = [];
  const regex = /\[\[([^|]+)\|([^\]]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: normalized.slice(lastIndex, match.index) });
    }
    segments.push({ type: "link", title: match[1], href: match[2] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < normalized.length) {
    let tail = normalized.slice(lastIndex);
    const partialStart = tail.lastIndexOf("[[");
    if (partialStart !== -1 && !tail.slice(partialStart).includes("]]")) {
      tail = tail.slice(0, partialStart);
    }
    if (tail) {
      segments.push({ type: "text", value: tail });
    }
  }

  return segments;
}

export function getGreeting(userName?: string | null): string {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = userName?.split(" ")[0];
  return `${greeting}${firstName ? `, ${firstName}` : ""}`;
}
