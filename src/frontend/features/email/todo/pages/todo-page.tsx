import {
 Empty,
 EmptyDescription,
 EmptyHeader,
 EmptyTitle,
} from "@/components/ui/empty";
import { TodoActionsPanel } from "@/features/email/todo/components/todo-actions-panel";
import { TodoQueuePanel } from "@/features/email/todo/components/todo-queue-panel";
import { TodoReaderPanel } from "@/features/email/todo/components/todo-reader-panel";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useTodoData } from "@/features/email/todo/hooks/use-todo-data";
import { useTodoDetail } from "@/features/email/todo/hooks/use-todo-detail";
import { useTodoSelection } from "@/features/email/todo/hooks/use-todo-selection";
import {
 MailboxPage,
 MailboxPageBody,
} from "@/features/email/shell/mailbox-page";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { ArrowLeftIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/todo");

export function TodoPage() {
 const { mailboxId } = route.useParams();
 const todoData = useTodoData({ mailboxId });

 if (!todoData.labelId && !todoData.isLoading) {
 return (
 <MailboxPage className="max-w-none">
 <MailboxPageBody className="flex items-center justify-center px-6 text-sm text-muted-foreground">
 Could not load the To-do label.
 </MailboxPageBody>
 </MailboxPage>
 );
 }

 if (!todoData.labelId) return null;

 return (
 <TodoView
 mailboxId={mailboxId}
 todoLabelId={todoData.labelId}
 todoData={todoData}
 />
 );
}

function TodoView({
 mailboxId,
 todoLabelId,
 todoData,
}: {
 mailboxId: number;
 todoLabelId: string;
 todoData: ReturnType<typeof useTodoData>;
}) {
 const navigate = route.useNavigate();
 const { openCompose } = useMailCompose();
 const groups = useMemo(
 () =>
 [...todoData.threadGroups].sort(
 (left, right) => right.representative.date - left.representative.date,
 ),
 [todoData.threadGroups],
 );
 const { selectedId, setSelectedId, selectedEmail } = useTodoSelection(groups);
 const { detailQuery, threadQuery, currentEmail, threadMessages } =
 useTodoDetail({
 selectedEmail,
 mailboxId,
 view: todoLabelId,
 });
 const selectedIndex = useMemo(
 () =>
 selectedId
 ? groups.findIndex((g) => g.representative.id === selectedId)
 : -1,
 [groups, selectedId],
 );
 const { executeEmailAction, todo } = useMailActions({
 view: todoLabelId,
 mailboxId,
 });

 const selectIndex = useCallback(
 (index: number) => {
 const nextIndex = Math.max(0, Math.min(index, groups.length - 1));
 const nextId = groups[nextIndex]?.representative.id;
 if (nextId) setSelectedId(nextId);
 },
 [groups, setSelectedId],
 );

 const selectedThreadIdentifier =
 selectedEmail?.threadId && selectedEmail.mailboxId
 ? {
 threadId: selectedEmail.threadId,
 mailboxId: selectedEmail.mailboxId,
 labelIds: selectedEmail.labelIds,
 }
 : undefined;

 useHotkeys({
 j: {
 enabled: groups.length > 0,
 onKeyDown: () => selectIndex(selectedIndex < 0 ? 0 : selectedIndex + 1),
 },
 ArrowDown: {
 enabled: groups.length > 0,
 onKeyDown: () => selectIndex(selectedIndex < 0 ? 0 : selectedIndex + 1),
 },
 k: {
 enabled: groups.length > 0,
 onKeyDown: () => selectIndex(selectedIndex < 0 ? 0 : selectedIndex - 1),
 },
 ArrowUp: {
 enabled: groups.length > 0,
 onKeyDown: () => selectIndex(selectedIndex < 0 ? 0 : selectedIndex - 1),
 },
 Enter: {
 enabled: groups.length > 0,
 onKeyDown: () => {
 if (selectedIndex < 0) selectIndex(0);
 },
 },
 e: {
 enabled: Boolean(selectedEmail),
 onKeyDown: () => {
 if (selectedEmail) void todo.remove(selectedEmail);
 },
 },
 Delete: {
 enabled: Boolean(selectedEmail),
 onKeyDown: () => {
 if (selectedEmail) void todo.remove(selectedEmail);
 },
 },
 Backspace: {
 enabled: Boolean(selectedEmail),
 onKeyDown: () => {
 if (selectedEmail) void todo.remove(selectedEmail);
 },
 },
 a: {
 enabled: Boolean(selectedEmail),
 onKeyDown: () => {
 if (!selectedEmail) return;
 void executeEmailAction(
 "archive",
 [selectedEmail.id],
 selectedThreadIdentifier,
 ).then(() => todo.remove(selectedEmail));
 },
 },
 u: {
 enabled: Boolean(selectedEmail),
 onKeyDown: () => {
 if (!selectedEmail) return;
 void executeEmailAction(
 selectedEmail.isRead ? "mark-unread" : "mark-read",
 [selectedEmail.id],
 selectedThreadIdentifier,
 );
 },
 },
 c: () => openCompose(),
 "/": (event) => {
 event.preventDefault();
 navigate({
 to: "/$mailboxId/inbox/search",
 params: { mailboxId },
 });
 },
 Escape: {
 enabled: selectedId != null,
 onKeyDown: () => setSelectedId(null),
 },
 });

 if (!todoData.hasEmails && !todoData.isLoading) {
 return (
 <MailboxPage className="max-w-none">
 <MailboxPageBody className="flex items-center justify-center">
 <Empty>
 <EmptyHeader>
 <EmptyTitle>No emails</EmptyTitle>
 <EmptyDescription>
 Messages marked as to-do will show up here.
 </EmptyDescription>
 </EmptyHeader>
 </Empty>
 </MailboxPageBody>
 </MailboxPage>
 );
 }

 const hasSelection = selectedId != null;
 const prevId = selectedIndex > 0 ? groups[selectedIndex - 1]?.representative.id : null;
 const nextId =
 selectedIndex >= 0 && selectedIndex < groups.length - 1
 ? groups[selectedIndex + 1]?.representative.id
 : null;

 return (
 <MailboxPage className="max-w-none">
 <MailboxPageBody className="p-2">
 <div className="flex min-h-0 w-full flex-1 flex-col gap-2 md:flex-row">
 <TodoQueuePanel
 groups={groups}
 selectedId={selectedId}
 onSelect={setSelectedId}
 className={hasSelection ? "hidden md:flex" : undefined}
 />
 {hasSelection && (
 <div className="flex shrink-0 items-center justify-between gap-2 px-1 md:hidden">
 <button
 type="button"
 onClick={() => setSelectedId(null)}
 className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
 >
 <ArrowLeftIcon className="size-3" />
 To do
 </button>
 <div className="flex items-center gap-2 pr-1 text-xs tabular-nums text-muted-foreground">
 <span>
 {selectedIndex + 1}
 <span className="text-foreground/30"> / {groups.length}</span>
 </span>
 <button
 type="button"
 onClick={() => prevId && setSelectedId(prevId)}
 disabled={!prevId}
 aria-label="Previous to-do"
 className="p-1 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
 >
 <CaretLeftIcon className="size-3.5" />
 </button>
 <button
 type="button"
 onClick={() => nextId && setSelectedId(nextId)}
 disabled={!nextId}
 aria-label="Next to-do"
 className="p-1 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
 >
 <CaretRightIcon className="size-3.5" />
 </button>
 </div>
 </div>
 )}
 <TodoReaderPanel
 currentEmail={currentEmail}
 threadMessages={threadMessages}
 hasDetailError={detailQuery.isError}
 hasThreadError={threadQuery.isError}
 onRetry={() => void detailQuery.refetch()}
 className={!hasSelection ? "hidden md:block" : undefined}
 />
 {selectedEmail && (
 <TodoActionsPanel
 selectedEmail={selectedEmail}
 detail={currentEmail}
 mailboxId={mailboxId}
 view={todoLabelId}
 hasThreadError={threadQuery.isError}
 />
 )}
 </div>
 </MailboxPageBody>
 </MailboxPage>
 );
}
