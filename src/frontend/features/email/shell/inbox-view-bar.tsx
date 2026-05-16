import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SplitRule } from "@/db/schema";
import {
  createMailboxSplitView,
  fetchSplitViews,
} from "@/features/email/split-views/queries";
import { splitViewQueryKeys } from "@/features/email/split-views/query-keys";
import { cn } from "@/lib/utils";
import { PlusIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

type CreateViewPayload = { name: string; rules: SplitRule | null };
type ViewRuleForm = {
  senders: string;
  domains: string;
  recipients: string;
  subjectContains: string;
  hasAttachment: boolean;
  fromMailingList: boolean;
};

const EMPTY_RULE_FORM: ViewRuleForm = {
  senders: "",
  domains: "",
  recipients: "",
  subjectContains: "",
  hasAttachment: false,
  fromMailingList: false,
};

function parseRuleList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSplitRule(form: ViewRuleForm): SplitRule | null {
  const senders = parseRuleList(form.senders);
  const domains = parseRuleList(form.domains);
  const recipients = parseRuleList(form.recipients);
  const subjectContains = parseRuleList(form.subjectContains);
  const rule: SplitRule = {};
  if (senders.length) rule.senders = senders;
  if (domains.length) rule.domains = domains;
  if (recipients.length) rule.recipients = recipients;
  if (subjectContains.length) rule.subjectContains = subjectContains;
  if (form.hasAttachment) rule.hasAttachment = true;
  if (form.fromMailingList) rule.fromMailingList = true;
  return Object.keys(rule).length > 0 ? rule : null;
}

export function InboxViewBar() {
  const { mailboxId } = mailboxRoute.useParams();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [ruleForm, setRuleForm] = useState<ViewRuleForm>(EMPTY_RULE_FORM);

  const activeViewId = useRouterState({
    select: (state) => {
      const match = state.matches.find((m) =>
        m.routeId.startsWith("/_dashboard/$mailboxId/views"),
      );
      const params = match?.params;
      const viewId = params && "viewId" in params ? params.viewId : null;
      return typeof viewId === "string" ? viewId : null;
    },
  });

  const splitViewsQuery = useQuery({
    queryKey: splitViewQueryKeys.all(),
    queryFn: fetchSplitViews,
    staleTime: 60_000,
  });
  const pinnedViews = useMemo(
    () =>
      (splitViewsQuery.data ?? [])
        .filter((view) => view.visible && view.pinned && !view.isSystem)
        .sort((left, right) => left.position - right.position),
    [splitViewsQuery.data],
  );

  const createViewMutation = useMutation({
    mutationFn: (input: CreateViewPayload) =>
      createMailboxSplitView({
        mailboxId,
        name: input.name,
        rules: input.rules,
      }),
    onSuccess: async (view) => {
      setViewName("");
      setRuleForm(EMPTY_RULE_FORM);
      setCreateOpen(false);
      await queryClient.invalidateQueries({
        queryKey: splitViewQueryKeys.all(),
      });
      toast.success(`Created ${view.name}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create view",
      );
    },
  });

  return (
    <>
      {pinnedViews.map((view) => (
        <Link
          key={view.id}
          to="/$mailboxId/views/$viewId"
          params={{ mailboxId, viewId: view.id }}
          preload="viewport"
          className={cn(
            "inline-flex h-7 max-w-34 items-center px-2 text-center text-sm transition-colors hover:text-primary",
            activeViewId === view.id
              ? "bg-muted text-primary"
              : "text-muted-foreground",
          )}
        >
          <span className="truncate">{view.name}</span>
        </Link>
      ))}
      <Button
        type="button"
        onClick={() => setCreateOpen(true)}
        size={"icon-sm"}
        variant={"ghost"}
        aria-label="Create view"
        title="Create view"
      >
        <PlusIcon className="size-3.5" />
      </Button>
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open && !createViewMutation.isPending) {
            setViewName("");
            setRuleForm(EMPTY_RULE_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createViewMutation.mutate({
                name: viewName,
                rules: buildSplitRule(ruleForm),
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Create view</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                placeholder="Name"
                className="text-xs h-7 placeholder:text-xs"
                autoFocus
              />
              <div className="grid gap-2">
                <Input
                  value={ruleForm.senders}
                  onChange={(event) =>
                    setRuleForm((form) => ({
                      ...form,
                      senders: event.target.value,
                    }))
                  }
                  className="text-xs h-7 placeholder:text-xs"
                  placeholder="Sender contains"
                />
                <Input
                  value={ruleForm.domains}
                  onChange={(event) =>
                    setRuleForm((form) => ({
                      ...form,
                      domains: event.target.value,
                    }))
                  }
                  className="text-xs h-7 placeholder:text-xs"
                  placeholder="Domain"
                />
                <Input
                  value={ruleForm.recipients}
                  onChange={(event) =>
                    setRuleForm((form) => ({
                      ...form,
                      recipients: event.target.value,
                    }))
                  }
                  className="text-xs h-7 placeholder:text-xs"
                  placeholder="Recipient"
                />
                <Input
                  value={ruleForm.subjectContains}
                  onChange={(event) =>
                    setRuleForm((form) => ({
                      ...form,
                      subjectContains: event.target.value,
                    }))
                  }
                  className="text-xs h-7 placeholder:text-xs"
                  placeholder="Subject contains"
                />
              </div>
              <div className="grid gap-2 pt-1 text-xs">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Checkbox
                    checked={ruleForm.hasAttachment}
                    onCheckedChange={(checked) =>
                      setRuleForm((form) => ({
                        ...form,
                        hasAttachment: checked === true,
                      }))
                    }
                  />
                  <span>Has attachment</span>
                </label>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Checkbox
                    checked={ruleForm.fromMailingList}
                    onCheckedChange={(checked) =>
                      setRuleForm((form) => ({
                        ...form,
                        fromMailingList: checked === true,
                      }))
                    }
                  />
                  <span>From mailing list</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setCreateOpen(false)}
                disabled={createViewMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!viewName.trim() || createViewMutation.isPending}
              >
                {createViewMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
