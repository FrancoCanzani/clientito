import { accountQueryKeys } from "@/features/settings/query-keys";
import {
 accountsQueryOptions,
 removeAccount,
} from "@/hooks/use-mailboxes";
import { forceSignOut } from "@/lib/app-version";
import { useSession } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";

export function useAuth() {
 const session = useSession();
 const isAuthenticated = Boolean(session.data?.user);

 return {
 user: session.data?.user ?? null,
 isLoading: session.isPending,
 isAuthenticated,
 error: session.error,
 };
}

export function useLogout() {
 const navigate = useNavigate();
 const currentMailboxId = useRouterState({
 select: (state) => {
 for (const match of state.matches) {
 const params = match.params as { mailboxId?: unknown } | undefined;
 if (params && typeof params.mailboxId === "number") {
 return params.mailboxId;
 }
 }
 return null;
 },
 });

 return useMutation({
 mutationFn: async () => {
 const data = await queryClient.ensureQueryData(accountsQueryOptions);
 const accounts = data.accounts.filter(
 (account) => account.mailboxId != null,
 );
 const current =
 currentMailboxId != null
 ? accounts.find((a) => a.mailboxId === currentMailboxId)
 : null;
 const others = accounts.filter(
 (a) => a.mailboxId !== currentMailboxId,
 );

 if (current && others.length > 0) {
 await removeAccount(current.accountId);
 await queryClient.invalidateQueries({
 queryKey: accountQueryKeys.all(),
 });
 await navigate({
 to: "/$mailboxId/inbox",
 params: { mailboxId: others[0]!.mailboxId! },
 });
 return { signedOut: false } as const;
 }

 await forceSignOut("user_logout");
 return { signedOut: true } as const;
 },
 onSuccess: (result) => {
 if (result.signedOut) {
 queryClient.clear();
 } else {
 toast.success("Mailbox disconnected");
 }
 },
 onError: (error) => {
 toast.error(error instanceof Error ? error.message : "Sign out failed");
 },
 });
}
