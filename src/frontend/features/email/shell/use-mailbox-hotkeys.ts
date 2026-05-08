import type { EmailFolderView } from "@/features/email/mail/views";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useHotkeys } from "@/hooks/use-hotkeys";
import {
 getRouteApi,
 useNavigate,
 useRouterState,
} from "@tanstack/react-router";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

type FolderShortcut = {
 key: string;
 folder: EmailFolderView;
};

const FOLDER_SHORTCUTS: FolderShortcut[] = [
 { key: "g s", folder: "starred" },
 { key: "g a", folder: "archived" },
 { key: "g e", folder: "sent" },
 { key: "g p", folder: "spam" },
 { key: "g x", folder: "trash" },
];

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

 const bindings: Record<string, () => void> = {
 "g i": () =>
 navigate({ to: "/$mailboxId/inbox", params: { mailboxId } }),
 "g f": () =>
 navigate({ to: "/$mailboxId/triage", params: { mailboxId } }),
 "g t": () =>
 navigate({ to: "/$mailboxId/todo", params: { mailboxId } }),
 "g d": () =>
 navigate({ to: "/$mailboxId/inbox/drafts", params: { mailboxId } }),
 "g ,": () =>
 navigate({ to: "/$mailboxId/settings", params: { mailboxId } }),
 };

 for (const shortcut of FOLDER_SHORTCUTS) {
 bindings[shortcut.key] = () =>
 navigate({
 to: "/$mailboxId/$folder",
 params: { mailboxId, folder: shortcut.folder },
 });
 }

 for (let index = 0; index < Math.min(accounts.length, 9); index++) {
 const account = accounts[index]!;
 bindings[`$mod+${index + 1}`] = () => {
 if (account.mailboxId === mailboxId) return;
 void navigate({
 to: switchTarget.to,
 params: switchTarget.getParams(account.mailboxId),
 });
 };
 }

 useHotkeys(bindings);
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
 if (matches.some((match) => match.routeId === "/_dashboard/$mailboxId/todo")) {
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
