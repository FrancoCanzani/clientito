import { emailQueryKeys } from "@/features/email/mail/query-keys";
import type { EmailListItem } from "@/features/email/mail/types";
import { TODO_LABEL_NAME } from "@/features/email/labels/internal-labels";
import { applyLabel, createLabel, removeLabel } from "@/features/email/labels/mutations";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import type { Label } from "@/features/email/labels/types";
import { queryClient } from "@/lib/query-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

type TodoEmail = Pick<EmailListItem, "providerMessageId" | "labelIds">;

export const todoLabelQueryKey = (mailboxId: number) =>
  ["labels", mailboxId, "todo"] as const;

function findTodoLabel(labels: Label[]): Label | null {
  const normalizedName = TODO_LABEL_NAME.toLowerCase();
  return labels.find((label) => label.name.toLowerCase() === normalizedName) ?? null;
}

async function fetchTodoLabel(mailboxId: number): Promise<Label | null> {
  return findTodoLabel(await fetchLabels(mailboxId));
}

export async function ensureTodoLabel(mailboxId: number): Promise<Label> {
  const existing = await fetchTodoLabel(mailboxId);
  if (existing) return existing;

  const created = await createLabel(mailboxId, {
    name: TODO_LABEL_NAME,
    textColor: "#000000",
    backgroundColor: "#fef1d1",
  });
  queryClient.setQueryData(todoLabelQueryKey(mailboxId), created);
  return created;
}

function asArray(target: TodoEmail | TodoEmail[]): TodoEmail[] {
  return Array.isArray(target) ? target : [target];
}

export function useTodoLabel(
  mailboxId: number,
  options: { autoCreate?: boolean } = {},
) {
  const reactQueryClient = useQueryClient();
  const labelQuery = useQuery({
    queryKey: todoLabelQueryKey(mailboxId),
    queryFn: () =>
      options.autoCreate ? ensureTodoLabel(mailboxId) : fetchTodoLabel(mailboxId),
    staleTime: 5 * 60_000,
  });

  const getLabel = useCallback(async () => {
    const label = await ensureTodoLabel(mailboxId);
    reactQueryClient.setQueryData(todoLabelQueryKey(mailboxId), label);
    await reactQueryClient.invalidateQueries({
      queryKey: labelQueryKeys.list(mailboxId),
    });
    return label;
  }, [mailboxId, reactQueryClient]);

  const addMutation = useMutation({
    mutationFn: async (target: TodoEmail | TodoEmail[]) => {
      const label = await getLabel();
      const emails = asArray(target);
      await applyLabel(
        emails.map((email) => email.providerMessageId),
        label.gmailId,
        mailboxId,
      );
      return label;
    },
    onSuccess: (label) => {
      reactQueryClient.setQueryData(todoLabelQueryKey(mailboxId), label);
      void reactQueryClient.invalidateQueries({ queryKey: emailQueryKeys.all() });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (target: TodoEmail | TodoEmail[]) => {
      const label = await getLabel();
      const emails = asArray(target);
      await removeLabel(
        emails.map((email) => email.providerMessageId),
        label.gmailId,
        mailboxId,
      );
      return label;
    },
    onSuccess: (label) => {
      reactQueryClient.setQueryData(todoLabelQueryKey(mailboxId), label);
      void reactQueryClient.invalidateQueries({ queryKey: emailQueryKeys.all() });
    },
  });

  const isTodo = useCallback(
    (email: Pick<EmailListItem, "labelIds">) => {
      const labelId = labelQuery.data?.gmailId;
      return Boolean(labelId && email.labelIds.includes(labelId));
    },
    [labelQuery.data?.gmailId],
  );

  const toggle = useCallback(
    (target: TodoEmail | TodoEmail[]) => {
      const first = asArray(target)[0];
      if (!first) return Promise.resolve();
      return isTodo(first)
        ? removeMutation.mutateAsync(target)
        : addMutation.mutateAsync(target);
    },
    [addMutation, isTodo, removeMutation],
  );

  return {
    label: labelQuery.data ?? null,
    labelId: labelQuery.data?.gmailId ?? null,
    isLoading: labelQuery.isLoading,
    isError: labelQuery.isError,
    error: labelQuery.error,
    isPending: addMutation.isPending || removeMutation.isPending,
    isTodo,
    add: addMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    toggle,
  };
}
