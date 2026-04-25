import { splitViewQueryKeys } from "@/features/email/splits/query-keys";
import { localDb } from "@/db/client";
import type {
  SplitRule,
  SplitViewRow,
} from "@/db/schema";
import { queryClient } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";

type ApiSplitView = {
  id: string;
  userId: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  position: number;
  visible: boolean;
  pinned: boolean;
  isSystem: boolean;
  systemKey: string | null;
  rules: SplitRule | null;
  matchMode: "rules";
  showInOther: boolean;
  createdAt: number;
  updatedAt: number;
};

function toRow(api: ApiSplitView): SplitViewRow {
  return { ...api };
}

async function fetchSplitViews(): Promise<SplitViewRow[]> {
  const response = await fetch("/api/split-views", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch split views (${response.status})`);
  }
  const json = (await response.json()) as {
    data: { splitViews: ApiSplitView[] };
  };
  const rows = json.data.splitViews.map(toRow);

  if (rows[0]) {
    try {
      await localDb.replaceSplitViews(rows[0].userId, rows);
    } catch {
      // OPFS may not be ready yet; UI still works from the API response.
    }
  }

  return rows.sort(
    (a, b) => a.position - b.position || a.createdAt - b.createdAt,
  );
}

export function useSplitViews() {
  return useQuery({
    queryKey: splitViewQueryKeys.all(),
    queryFn: fetchSplitViews,
    staleTime: 30_000,
  });
}

export type SplitViewCreateInput = {
  name: string;
  description?: string;
  icon?: string | null;
  color?: string | null;
  rules?: SplitRule | null;
  showInOther?: boolean;
  pinned?: boolean;
  visible?: boolean;
};

export async function createSplitView(
  input: SplitViewCreateInput,
): Promise<SplitViewRow> {
  const response = await fetch("/api/split-views", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create split (${response.status})`);
  }
  const json = (await response.json()) as {
    data: { splitView: ApiSplitView };
  };
  const row = toRow(json.data.splitView);
  queryClient.invalidateQueries({ queryKey: splitViewQueryKeys.all() });
  return row;
}

async function updateSplitView(
  id: string,
  patch: Partial<SplitViewCreateInput> & { position?: number },
): Promise<SplitViewRow> {
  const response = await fetch(`/api/split-views/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`Failed to update split (${response.status})`);
  }
  const json = (await response.json()) as {
    data: { splitView: ApiSplitView };
  };
  const row = toRow(json.data.splitView);
  queryClient.invalidateQueries({ queryKey: splitViewQueryKeys.all() });
  return row;
}

export async function setSplitViewVisible(
  id: string,
  visible: boolean,
): Promise<SplitViewRow> {
  return updateSplitView(id, { visible });
}

export async function setSystemSplitVisible(
  systemKey: string,
  visible: boolean,
): Promise<SplitViewRow> {
  const response = await fetch(
    `/api/split-views/system/${encodeURIComponent(systemKey)}/visible`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to toggle system split (${response.status})`);
  }
  const json = (await response.json()) as {
    data: { splitView: ApiSplitView };
  };
  const row = toRow(json.data.splitView);
  queryClient.invalidateQueries({ queryKey: splitViewQueryKeys.all() });
  return row;
}
