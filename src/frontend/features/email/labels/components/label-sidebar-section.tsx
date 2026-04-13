import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchLabels } from "../../labels/queries";
import { Link } from "@tanstack/react-router";

type LabelSidebarSectionProps = {
  mailboxId: number;
  activeLabelId?: string;
};

export function LabelSidebarSection({ mailboxId, activeLabelId }: LabelSidebarSectionProps) {
  const labelsQuery = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const labels = labelsQuery.data ?? [];
  if (labels.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Labels</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {labels.map((label) => (
            <SidebarMenuItem key={label.gmailId}>
              <SidebarMenuButton
                asChild
                isActive={activeLabelId === label.gmailId}
                tooltip={label.name}
              >
                <Link
                  to="/$mailboxId/inbox/labels/$label"
                  params={{ mailboxId, label: label.gmailId }}
                  preload="intent"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.backgroundColor ?? "#999" }}
                  />
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    {label.name}
                  </span>
                  {label.messagesUnread > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
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
