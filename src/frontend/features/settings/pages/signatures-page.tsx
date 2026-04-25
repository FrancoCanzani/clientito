import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextField } from "@/features/settings/components/rich-text-field";
import { SettingsSectionHeader } from "@/features/settings/components/settings-shell";
import { useSettingsMutations } from "@/features/settings/hooks/use-settings-mutations";
import {
  useMailboxes,
  type MailboxSignature,
  type MailboxSignatureState,
} from "@/hooks/use-mailboxes";
import { CheckIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const emptySignatureState: MailboxSignatureState = {
  defaultId: null,
  items: [],
};

export default function SignaturesPage() {
  const navigate = useNavigate();
  const { mailboxId } = useParams({ from: "/_dashboard/$mailboxId/settings" });
  const accountsQuery = useMailboxes();
  const account =
    accountsQuery.data?.accounts.find((entry) => entry.mailboxId === mailboxId) ??
    null;
  const initialState = useMemo(
    () => normalizeState(account?.signatures ?? emptySignatureState),
    [account?.signatures],
  );
  const [state, setState] = useState<MailboxSignatureState>(initialState);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialState.items[0]?.id ?? null,
  );
  const { signatureMutation } = useSettingsMutations({ navigate });

  useEffect(() => {
    setState(initialState);
    setSelectedId(initialState.items[0]?.id ?? null);
  }, [initialState]);

  const selectedItem =
    state.items.find((item) => item.id === selectedId) ?? state.items[0] ?? null;
  const isDirty = serializeState(state) !== serializeState(initialState);

  function updateItem(id: string, patch: Partial<MailboxSignature>) {
    setState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addSignature() {
    const id = createItemId("sig");
    setState((current) => ({
      defaultId: current.defaultId ?? id,
      items: [
        ...current.items,
        {
          id,
          name: `Signature ${current.items.length + 1}`,
          body: "",
        },
      ],
    }));
    setSelectedId(id);
  }

  function deleteSignature(id: string) {
    setState((current) => {
      const items = current.items.filter((item) => item.id !== id);
      return {
        defaultId:
          current.defaultId === id ? (items[0]?.id ?? null) : current.defaultId,
        items,
      };
    });
    if (selectedId === id) {
      setSelectedId(state.items.find((item) => item.id !== id)?.id ?? null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SettingsSectionHeader
          group="Mail"
          title="Signatures"
          description="Create rich email signatures and choose the default for this account."
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addSignature}>
            <PlusIcon className="mr-1.5 size-3.5" />
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isDirty || account?.mailboxId == null || signatureMutation.isPending}
            onClick={() => {
              if (account?.mailboxId == null) return;
              signatureMutation.mutate({
                mailboxId: account.mailboxId,
                signature: serializeState(state),
              });
            }}
          >
            {signatureMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 border-t border-border/60 pt-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-2">
          {state.items.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">
              No signatures yet.
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
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {item.name.trim() || "Untitled signature"}
                  </span>
                  {state.defaultId === item.id && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {toSnippet(item.body) || "Empty signature"}
                </p>
              </button>
            ))
          )}
        </div>

        {selectedItem ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={selectedItem.name}
                onChange={(event) =>
                  updateItem(selectedItem.id, { name: event.target.value })
                }
                placeholder="Signature name"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant={state.defaultId === selectedItem.id ? "secondary" : "outline"}
                onClick={() =>
                  setState((current) => ({
                    ...current,
                    defaultId: selectedItem.id,
                  }))
                }
              >
                <CheckIcon className="mr-1.5 size-3.5" />
                Default
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 text-destructive hover:text-destructive"
                onClick={() => deleteSignature(selectedItem.id)}
                title="Delete signature"
              >
                <TrashIcon className="size-3.5" />
              </Button>
            </div>
            <RichTextField
              value={selectedItem.body}
              onChange={(body) => updateItem(selectedItem.id, { body })}
            />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/70 p-6 text-xs text-muted-foreground">
            Add a signature to edit it here.
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

function normalizeState(state: MailboxSignatureState): MailboxSignatureState {
  const items = state.items
    .map((item) => ({
      id: item.id.trim(),
      name: item.name.trim(),
      body: item.body,
    }))
    .filter((item) => item.id.length > 0 && item.name.length > 0);
  const hasDefault = items.some((item) => item.id === state.defaultId);
  return {
    defaultId: hasDefault ? state.defaultId : (items[0]?.id ?? null),
    items,
  };
}

function serializeState(state: MailboxSignatureState): string {
  return JSON.stringify(normalizeState(state));
}

function toSnippet(html: string): string {
  if (typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
