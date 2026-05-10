import { useMailboxes } from "@/hooks/use-mailboxes";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { getShortcut } from "@/lib/shortcuts";
import {
  getRouteApi,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

export function useMailboxHotkeys() {
  const { mailboxId } = mailboxRoute.useParams();
  const navigate = useNavigate();
  const accounts = (useMailboxes().data?.accounts ?? []).filter(
    (account): account is typeof account & { mailboxId: number } =>
      account.mailboxId != null,
  );
  const switchTarget = useRouterState({
    select: (state) => deriveSwitchTarget(state.matches),
  });

  useShortcuts("global", {
    "nav:inbox": () =>
      navigate({ to: "/$mailboxId/inbox", params: { mailboxId } }),
    "nav:triage": () =>
      navigate({ to: "/$mailboxId/triage", params: { mailboxId } }),
    "nav:todo": () =>
      navigate({ to: "/$mailboxId/todo", params: { mailboxId } }),
    "nav:drafts": () =>
      navigate({ to: "/$mailboxId/inbox/drafts", params: { mailboxId } }),
    "nav:settings": () =>
      navigate({ to: "/$mailboxId/settings", params: { mailboxId } }),
    "nav:starred": () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder: "starred" },
      }),
    "nav:archived": () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder: "archived" },
      }),
    "nav:sent": () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder: "sent" },
      }),
    "nav:spam": () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder: "spam" },
      }),
    "nav:trash": () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder: "trash" },
      }),
    "nav:search": () =>
      navigate({
        to: "/$mailboxId/inbox/search",
        params: { mailboxId },
      }),
    "nav:screener": () =>
      navigate({
        to: "/$mailboxId/screener",
        params: { mailboxId },
      }),
  });

  const accountBindings: Record<string, () => void> = {};
  for (let index = 0; index < Math.min(accounts.length, 9); index++) {
    const account = accounts[index]!;
    const def = getShortcut(`nav:account-${index + 1}`);
    if (!def) continue;
    accountBindings[def.key] = () => {
      if (account.mailboxId === mailboxId) return;
      void navigate({
        to: switchTarget.to,
        params: switchTarget.getParams(account.mailboxId),
      });
    };
  }

  useHotkeys(accountBindings);
}

type SwitchTarget = {
  to: string;
  getParams: (nextMailboxId: number) => Record<string, unknown>;
};

function deriveSwitchTarget(
  matches: ReturnType<typeof useRouterState>["matches"],
): SwitchTarget {
  if (
    matches.some((match) => match.routeId === "/_dashboard/$mailboxId/triage")
  ) {
    return {
      to: "/$mailboxId/triage",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some((match) => match.routeId === "/_dashboard/$mailboxId/todo")
  ) {
    return {
      to: "/$mailboxId/todo",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some(
      (match) => match.routeId === "/_dashboard/$mailboxId/inbox/drafts",
    )
  ) {
    return {
      to: "/$mailboxId/inbox/drafts",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }
  if (
    matches.some(
      (match) => match.routeId === "/_dashboard/$mailboxId/inbox/search",
    )
  ) {
    return {
      to: "/$mailboxId/inbox/search",
      getParams: (mailboxId) => ({ mailboxId }),
    };
  }

  const folder = matches.find(
    (match) =>
      match.routeId === "/_dashboard/$mailboxId/$folder/" ||
      match.routeId === "/_dashboard/$mailboxId/$folder/email/$emailId",
  )?.params.folder;

  if (typeof folder === "string") {
    return {
      to: "/$mailboxId/$folder",
      getParams: (mailboxId) => ({ mailboxId, folder }),
    };
  }

  return {
    to: "/$mailboxId/inbox",
    getParams: (mailboxId) => ({ mailboxId }),
  };
}
