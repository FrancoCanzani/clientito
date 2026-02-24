import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";
import type { AuthUser, LoginInput, RegisterInput } from "@/features/auth/auth-types";

function toAuthUser(user: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image,
  };
}

export function useAuth() {
  const session = useSession();
  const isAuthenticated = Boolean(session.data?.user);

  return {
    user: session.data?.user ? toAuthUser(session.data.user) : null,
    isLoading: session.isPending,
    isAuthenticated,
    error: session.error,
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
