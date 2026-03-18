import type { HomeBriefing } from "./queries";

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
