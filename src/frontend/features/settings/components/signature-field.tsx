import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";

type SignatureItem = {
  id: string;
  name: string;
  body: string;
};

type SignatureState = {
  defaultId: string | null;
  items: SignatureItem[];
};

function createSignatureId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeState(state: SignatureState): SignatureState {
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

function parseState(raw: string): SignatureState {
  const value = raw.trim();
  if (!value) {
    return { defaultId: null, items: [] };
  }

  try {
    const parsed = JSON.parse(value) as {
      defaultId?: unknown;
      items?: Array<{ id?: unknown; name?: unknown; body?: unknown }>;
    };
    if (Array.isArray(parsed.items)) {
      return normalizeState({
        defaultId:
          typeof parsed.defaultId === "string" ? parsed.defaultId : null,
        items: parsed.items
          .filter(
            (item) =>
              typeof item?.id === "string" &&
              typeof item?.name === "string" &&
              typeof item?.body === "string",
          )
          .map((item) => ({
            id: item.id as string,
            name: item.name as string,
            body: item.body as string,
          })),
      });
    }
  } catch {}

  return {
    defaultId: "default",
    items: [{ id: "default", name: "Default", body: value }],
  };
}

function serializeState(state: SignatureState): string {
  return JSON.stringify(normalizeState(state));
}

export function SignatureField({
  mailboxId,
  initialSignature,
  isSaving,
  onSave,
}: {
  mailboxId: number | null;
  initialSignature: string;
  isSaving: boolean;
  onSave: (mailboxId: number, signature: string) => void;
}) {
  const initialState = useMemo(
    () => parseState(initialSignature),
    [initialSignature],
  );
  const [state, setState] = useState<SignatureState>(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const isDirty = serializeState(state) !== serializeState(initialState);

  if (mailboxId == null) return null;

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="space-y-0.5">
        <p className="text-xs font-medium">Signature</p>
        <p className="text-xs text-muted-foreground">
          Create and pick the default signature for this account.
        </p>
      </div>

      <div className="space-y-4">
        {state.items.map((item) => {
          const isDefault = state.defaultId === item.id;
          return (
            <div
              key={item.id}
              className="space-y-2 border-t border-border/40 pt-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setState((current) => ({
                      ...current,
                      items: current.items.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, name: nextName }
                          : entry,
                      ),
                    }));
                  }}
                  placeholder="Signature name"
                  className="h-7 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant={isDefault ? "secondary" : "outline"}
                  onClick={() =>
                    setState((current) => ({ ...current, defaultId: item.id }))
                  }
                >
                  {isDefault ? "Default" : "Set default"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setState((current) => {
                      const nextItems = current.items.filter(
                        (entry) => entry.id !== item.id,
                      );
                      return normalizeState({
                        defaultId:
                          current.defaultId === item.id
                            ? (nextItems[0]?.id ?? null)
                            : current.defaultId,
                        items: nextItems,
                      });
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
              <Textarea
                value={item.body}
                onChange={(e) => {
                  const nextBody = e.target.value;
                  setState((current) => ({
                    ...current,
                    items: current.items.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, body: nextBody }
                        : entry,
                    ),
                  }));
                }}
                placeholder="Signature content..."
                rows={4}
                className="text-xs"
              />
            </div>
          );
        })}

        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const id = createSignatureId();
              setState((current) =>
                normalizeState({
                  defaultId: current.defaultId ?? id,
                  items: [
                    ...current.items,
                    {
                      id,
                      name: `Signature ${current.items.length + 1}`,
                      body: "",
                    },
                  ],
                }),
              );
            }}
          >
            Add signature
          </Button>
        </div>

        {isDirty && (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => onSave(mailboxId, serializeState(state))}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
