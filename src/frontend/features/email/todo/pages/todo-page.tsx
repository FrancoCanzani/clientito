import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { TodoActionsPanel } from "@/features/email/todo/components/todo-actions-panel";
import { TodoQueuePanel } from "@/features/email/todo/components/todo-queue-panel";
import { TodoReaderPanel } from "@/features/email/todo/components/todo-reader-panel";
import { useTodoData } from "@/features/email/todo/hooks/use-todo-data";
import { useTodoDetail } from "@/features/email/todo/hooks/use-todo-detail";
import { useTodoSelection } from "@/features/email/todo/hooks/use-todo-selection";
import {
  MailboxPage,
  MailboxPageBody,
} from "@/features/email/shell/mailbox-page";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";

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

  if (!todoData.hasEmails && !todoData.isLoading) {
    return (
      <MailboxPage className="max-w-none">
        <MailboxPageBody className="flex items-center justify-center">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Empty.</EmptyTitle>
              <EmptyDescription>
                Mark an email as to-do to fill this in.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </MailboxPageBody>
      </MailboxPage>
    );
  }

  return (
    <MailboxPage className="max-w-none">
      <MailboxPageBody className="p-2">
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 md:flex-row">
          <TodoQueuePanel
            groups={groups}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <TodoReaderPanel
            currentEmail={currentEmail}
            threadMessages={threadMessages}
            hasDetailError={detailQuery.isError}
            hasThreadError={threadQuery.isError}
            onRetry={() => void detailQuery.refetch()}
          />
          {selectedEmail ? (
            <TodoActionsPanel
              selectedEmail={selectedEmail}
              detail={currentEmail}
              mailboxId={mailboxId}
              view={todoLabelId}
              hasThreadError={threadQuery.isError}
            />
          ) : null}
        </div>
      </MailboxPageBody>
    </MailboxPage>
  );
}
