import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut, useSession } from "@/lib/auth-client";

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await signOut();
      if (result.error) {
        throw new Error(result.error.message || "Failed to log out");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
