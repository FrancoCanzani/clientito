import type { HomeBriefing } from "./queries";

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

type GreetingStat = {
  key: "needsReply" | "overdue" | "dueToday";
  label: string;
};

export function getGreeting(userName?: string | null, briefing?: HomeBriefing): {
  line: string;
  stats: GreetingStat[];
} {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = userName?.split(" ")[0];

  if (!briefing) {
    return {
      line: `${greeting}${firstName ? `, ${firstName}` : ""}`,
      stats: [],
    };
  }

  const stats: GreetingStat[] = [];

  if (briefing.counts.needsReply > 0) {
    stats.push({
      key: "needsReply",
      label: `${briefing.counts.needsReply} need${briefing.counts.needsReply === 1 ? "s" : ""} a reply`,
    });
  }

  if (briefing.counts.overdue > 0) {
    stats.push({
      key: "overdue",
      label: `${briefing.counts.overdue} overdue task${briefing.counts.overdue === 1 ? "" : "s"}`,
    });
  }

  if (briefing.counts.dueToday > 0) {
    stats.push({
      key: "dueToday",
      label: `${briefing.counts.dueToday} due today`,
    });
  }

  return {
    line: `${greeting}${firstName ? `, ${firstName}` : ""}`,
    stats,
  };
}
