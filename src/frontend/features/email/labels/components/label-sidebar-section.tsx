import { labelQueryKeys } from "@/features/email/labels/query-keys";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CaretDownIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { fetchLabels } from "../../labels/queries";

type LabelSidebarSectionProps = {
  mailboxId: number;
  activeLabelId?: string;
};

export function LabelSidebarSection({
  mailboxId,
  activeLabelId,
}: LabelSidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const labelsQuery = useQuery({
    queryKey: labelQueryKeys.list(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const labels = useMemo(() => {
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return [...(labelsQuery.data ?? [])]
      .filter((label) => label.type === "user")
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [labelsQuery.data]);

  if (labels.length === 0) return null;

  return (
    <SidebarGroup>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarGroupLabel>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-1 text-left"
              aria-label={isOpen ? "Hide labels" : "Show labels"}
            >
              <span>Labels</span>
              <CaretDownIcon
                className={`ml-auto size-3 text-muted-foreground transition-transform ${
                  isOpen ? "" : "-rotate-90"
                }`}
              />
            </button>
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent className="max-h-48 overflow-y-auto">
            <SidebarMenu className="gap-1">
              {labels.map((label) => (
                <SidebarMenuItem key={label.gmailId}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeLabelId === label.gmailId}
                    tooltip={label.name}
                    className="text-sm"
                  >
                    <Link
                      to="/$mailboxId/inbox/labels/$label"
                      params={{ mailboxId, label: label.gmailId }}
                      preload="intent"
                    >
                      <span
                        className="flex size-2.5 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${label.backgroundColor ?? "#999"}30`,
                        }}
                      >
                        <span
                          className="size-1.5 rounded-full"
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
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}
