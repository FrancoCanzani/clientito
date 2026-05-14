import { forceSignOut } from "@/lib/app-version";
import { useSession } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";
import { useMutation } from "@tanstack/react-query";

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
 return useMutation({
 mutationFn: () => forceSignOut("user_logout"),
 onSuccess: () => {
 queryClient.clear();
 },
 });
}
