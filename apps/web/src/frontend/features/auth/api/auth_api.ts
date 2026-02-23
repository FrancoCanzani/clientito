import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { signIn, signOut, signUp, useSession } from "@/lib/auth_client";
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
} from "@/features/auth/auth_types";

const APP_USER_QUERY_KEY = ["auth", "app-user"] as const;

function fetchCurrentUser() {
  return apiFetch<AuthResponse>("/users/me");
}

export function useAuth() {
  const session = useSession();
  const isAuthenticated = Boolean(session.data?.user);

  const query = useQuery({
    queryKey: APP_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: query.data?.user ?? null,
    isLoading: session.isPending || (isAuthenticated && query.isLoading),
    isAuthenticated,
    error: session.error ?? query.error,
  };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginInput) => {
      const result = await signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        throw new Error(result.error.message || "Invalid email or password");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APP_USER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const result = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      });

      if (result.error) {
        throw new Error(result.error.message || "Unable to create account");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APP_USER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
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
