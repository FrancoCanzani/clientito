import { Error as RouteError } from "@/components/error";
import {
  fetchTodoPage,
  todoDataQueryKey,
} from "@/features/email/todo/hooks/use-todo-data";
import { TodoPage } from "@/features/email/todo/pages/todo-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/todo")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureInfiniteQueryData({
      queryKey: todoDataQueryKey(params.mailboxId),
      queryFn: () => fetchTodoPage(params.mailboxId),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: () => undefined,
    });
  },
  errorComponent: RouteError,
  component: TodoPage,
});
