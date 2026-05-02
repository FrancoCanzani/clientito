import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEMPLATE_VARIABLES } from "@/features/email/mail/compose/template-interpolation";
import { RichTextField } from "@/features/settings/components/rich-text-field";
import { SettingsSectionHeader } from "@/features/settings/components/settings-shell";
import { useSettingsMutations } from "@/features/settings/hooks/use-settings-mutations";
import {
  useMailboxes,
  type MailboxTemplate,
  type MailboxTemplateState,
} from "@/hooks/use-mailboxes";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const emptyTemplateState: MailboxTemplateState = { items: [] };

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { mailboxId } = useParams({ from: "/_dashboard/$mailboxId/settings" });
  const accountsQuery = useMailboxes();
  const account =
    accountsQuery.data?.accounts.find((entry) => entry.mailboxId === mailboxId) ??
    null;
  const initialState = useMemo(
    () => normalizeState(account?.templates ?? emptyTemplateState),
    [account?.templates],
  );
  const [state, setState] = useState<MailboxTemplateState>(initialState);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialState.items[0]?.id ?? null,
  );
  const [focusedField, setFocusedField] = useState<"subject" | "body">("body");
  const { templatesMutation } = useSettingsMutations({ navigate });

  useEffect(() => {
    setState(initialState);
    setSelectedId(initialState.items[0]?.id ?? null);
  }, [initialState]);

  const selectedItem =
    state.items.find((item) => item.id === selectedId) ?? state.items[0] ?? null;
  const isDirty = serializeState(state) !== serializeState(initialState);

  function updateItem(id: string, patch: Partial<MailboxTemplate>) {
    setState((current) => ({
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addTemplate() {
    const id = createItemId("tpl");
    setState((current) => ({
      items: [
        ...current.items,
        {
          id,
          name: `Template ${current.items.length + 1}`,
          subject: "",
          body: "",
        },
      ],
    }));
    setSelectedId(id);
  }

  function deleteTemplate(id: string) {
    setState((current) => ({
      items: current.items.filter((item) => item.id !== id),
    }));
    if (selectedId === id) {
      setSelectedId(state.items.find((item) => item.id !== id)?.id ?? null);
    }
  }

  function insertVariable(token: string) {
    if (!selectedItem) return;
    if (focusedField === "subject") {
      const next = selectedItem.subject
        ? `${selectedItem.subject} ${token}`
        : token;
      updateItem(selectedItem.id, { subject: next });
      return;
    }
    const trimmedBody = selectedItem.body.trim();
    const next = trimmedBody
      ? `${selectedItem.body}<p>${token}</p>`
      : `<p>${token}</p>`;
    updateItem(selectedItem.id, { body: next });
  }

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SettingsSectionHeader
          group="Mail"
          title="Templates"
          description="Save reusable subject and body snippets for compose."
        />
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addTemplate}
            className="flex-1 sm:flex-none"
          >
            <PlusIcon className="mr-1.5 size-3.5" />
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={!isDirty || account?.mailboxId == null || templatesMutation.isPending}
            onClick={() => {
              if (account?.mailboxId == null) return;
              templatesMutation.mutate({
                mailboxId: account.mailboxId,
                templates: serializeState(state),
              });
            }}
          >
            {templatesMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-4 border-t border-border/60 pt-4">
        <div className="min-w-0 space-y-2">
          {state.items.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">
              No templates yet.
            </p>
          ) : (
            state.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  selectedItem?.id === item.id
                    ? "border-foreground/25 bg-muted/70"
                    : "border-border/60 hover:bg-muted/50"
                }`}
              >
                <p className="truncate text-xs font-medium">
                  {item.name.trim() || "Untitled template"}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {item.subject || toSnippet(item.body) || "Empty template"}
                </p>
              </button>
            ))
          )}
        </div>

        {selectedItem ? (
          <div className="min-w-0 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={selectedItem.name}
                onChange={(event) =>
                  updateItem(selectedItem.id, { name: event.target.value })
                }
                placeholder="Template name"
                className="h-8 w-full text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive sm:size-8 sm:px-0"
                onClick={() => deleteTemplate(selectedItem.id)}
                title="Delete template"
              >
                <TrashIcon className="mr-1.5 size-3.5 sm:mr-0" />
                <span className="sm:hidden">Delete</span>
              </Button>
            </div>
            <Input
              value={selectedItem.subject}
              onChange={(event) =>
                updateItem(selectedItem.id, { subject: event.target.value })
              }
              onFocus={() => setFocusedField("subject")}
              placeholder="Subject"
              className="h-8 text-xs"
            />
            <div onFocus={() => setFocusedField("body")}>
              <RichTextField
                value={selectedItem.body}
                onChange={(body) => updateItem(selectedItem.id, { body })}
              />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Click a variable to insert it into the {focusedField}. Variables
                resolve when the template is inserted into a draft.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <button
                    key={variable.token}
                    type="button"
                    onClick={() => insertVariable(variable.token)}
                    title={variable.description}
                    className="rounded border border-border/60 bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    {variable.token}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/70 p-6 text-xs text-muted-foreground">
            Add a template to edit it here.
          </div>
        )}
      </div>
    </section>
  );
}

function createItemId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeState(state: MailboxTemplateState): MailboxTemplateState {
  const items = state.items
    .map((item) => ({
      id: item.id.trim(),
      name: item.name.trim(),
      subject: item.subject,
      body: item.body,
    }))
    .filter((item) => item.id.length > 0 && item.name.length > 0);
  return { items };
}

function serializeState(state: MailboxTemplateState): string {
  return JSON.stringify(normalizeState(state));
}

function toSnippet(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
