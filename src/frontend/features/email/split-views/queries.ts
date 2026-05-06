import { localDb } from "@/db/client";
import type { SplitRule, SplitViewRow } from "@/db/schema";
import { getCurrentUserId } from "@/db/user";
import { createLabel } from "@/features/email/labels/mutations";
import { splitViewQueryKeys } from "@/features/email/split-views/query-keys";
import { queryClient } from "@/lib/query-client";

type SplitViewsResponse = {
  data?: {
    splitViews?: SplitViewRow[];
    splitView?: SplitViewRow;
  };
  error?: string;
};

function normalizeRules(raw: unknown): SplitRule | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as SplitRule;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as SplitRule;
  } catch {
    return null;
  }
}

function normalizeSplitView(row: SplitViewRow): SplitViewRow {
  return {
    ...row,
    visible: Boolean(row.visible),
    pinned: Boolean(row.pinned),
    isSystem: Boolean(row.isSystem),
    showInOther: Boolean(row.showInOther),
    rules: normalizeRules(row.rules),
  };
}

async function readLocalSplitViews(): Promise<SplitViewRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  await localDb.ensureReady();
  return localDb.listSplitViews(userId);
}

export async function fetchSplitViews(): Promise<SplitViewRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  try {
    const response = await fetch("/api/split-views");
    const json = (await response.json().catch(() => null)) as SplitViewsResponse | null;
    if (!response.ok) {
      throw new Error(json?.error ?? "Failed to fetch views");
    }

    const rows = (json?.data?.splitViews ?? []).map(normalizeSplitView);
    await localDb.ensureReady();
    await localDb.replaceSplitViews(userId, rows);
    return rows;
  } catch {
    return readLocalSplitViews();
  }
}

async function createSplitView(input: {
  name: string;
  rules: SplitRule;
}): Promise<SplitViewRow> {
  const response = await fetch("/api/split-views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      rules: input.rules,
      pinned: true,
      visible: true,
      showInOther: true,
    }),
  });
  const json = (await response.json().catch(() => null)) as SplitViewsResponse | null;
  if (!response.ok || !json?.data?.splitView) {
    throw new Error(json?.error ?? "Failed to create view");
  }
  return normalizeSplitView(json.data.splitView);
}

export async function createMailboxSplitView(params: {
  mailboxId: number;
  name: string;
  rules?: SplitRule | null;
}): Promise<SplitViewRow> {
  const name = params.name.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Name is required");

  let rules = params.rules;
  if (!rules) {
    const label = await createLabel(params.mailboxId, {
      name: `Duomo/${name}`,
    });
    rules = { gmailLabels: [label.gmailId] };
  }

  const view = await createSplitView({
    name,
    rules,
  });

  const userId = await getCurrentUserId();
  if (userId) {
    await localDb.ensureReady();
    await localDb.upsertSplitView(view);
  }
  await queryClient.invalidateQueries({ queryKey: splitViewQueryKeys.all() });
  return view;
}

export function getPrimarySplitViewLabelId(
  view: SplitViewRow | null | undefined,
): string | null {
  return view?.rules?.gmailLabels?.find(Boolean) ?? null;
}
