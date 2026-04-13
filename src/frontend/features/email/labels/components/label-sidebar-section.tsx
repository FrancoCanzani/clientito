import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchLabels } from "../../labels/queries";
import { createLabel } from "../../labels/mutations";
import { LabelEditor } from "./label-editor";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";

type LabelSidebarSectionProps = {
  mailboxId: number;
  activeLabelId?: string;
};

export function LabelSidebarSection({ mailboxId, activeLabelId }: LabelSidebarSectionProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const labelsQuery = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const labels = labelsQuery.data ?? [];

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    await createLabel(mailboxId, { name });
    setNewName("");
    setIsCreating(false);
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Labels</SidebarGroupLabel>
      <SidebarGroupAction
        title="Create label"
        onClick={() => setIsCreating((v) => !v)}
        className="group-data-[collapsible=icon]:hidden"
      >
        <PlusIcon className="size-3.5" />
      </SidebarGroupAction>
      <SidebarGroupContent className="max-h-48 overflow-y-auto">
        <SidebarMenu>
          {isCreating && (
            <SidebarMenuItem>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Label name"
                className="h-7 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setIsCreating(false);
                    setNewName("");
                  }
                }}
                onBlur={() => {
                  if (!newName.trim()) {
                    setIsCreating(false);
                    setNewName("");
                  }
                }}
              />
            </SidebarMenuItem>
          )}
          {labels.map((label) => (
            <SidebarMenuItem key={label.gmailId} className="group/label">
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
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.backgroundColor ?? "#999" }}
                  />
                  <span className="truncate group-data-[collapsible=icon]:hidden">
                    {label.name}
                  </span>
                  {label.messagesUnread > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground group-data-[collapsible=icon]:hidden group-hover/label:hidden">
                      {label.messagesUnread}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
              <LabelEditor
                label={label}
                mailboxId={mailboxId}
                onDeleted={() =>
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.labels(mailboxId),
                  })
                }
                trigger={
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground group-hover/label:inline-flex group-data-[collapsible=icon]:!hidden"
                    onClick={(e) => e.preventDefault()}
                  >
                    <PencilSimpleIcon className="size-3" />
                  </button>
                }
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
