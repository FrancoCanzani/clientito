import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { queryKeys } from "@/lib/query-keys";
import { GearIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchLabels } from "../../labels/queries";

type LabelSidebarSectionProps = {
  mailboxId: number;
  activeLabelId?: string;
};

export function LabelSidebarSection({
  mailboxId,
  activeLabelId,
}: LabelSidebarSectionProps) {
  const labelsQuery = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const labels = labelsQuery.data ?? [];

  if (labels.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="group/labels">
        <span>Labels</span>
        <Link
          to="/$mailboxId/settings"
          params={{ mailboxId }}
          hash="labels"
          className="ml-auto opacity-0 transition-opacity group-hover/labels:opacity-100"
        >
          <GearIcon className="size-3 text-muted-foreground hover:text-foreground" />
        </Link>
      </SidebarGroupLabel>
      <SidebarGroupContent className="max-h-48 overflow-y-auto">
        <SidebarMenu className="gap-1">
          {labels.map((label) => (
            <SidebarMenuItem key={label.gmailId}>
              <SidebarMenuButton
                asChild
                isActive={activeLabelId === label.gmailId}
                tooltip={label.name}
                className="text-base text-gray-600"
              >
                <Link
                  to="/$mailboxId/inbox/labels/$label"
                  params={{ mailboxId, label: label.gmailId }}
                  preload="intent"
                >
                  <span
                    className="flex size-3 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `${label.backgroundColor ?? "#999"}30`,
                    }}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: label.backgroundColor ?? "#999",
                      }}
                    />
                  </span>
                  <span className="truncate">{label.name}</span>
                  {label.messagesUnread > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {label.messagesUnread}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
