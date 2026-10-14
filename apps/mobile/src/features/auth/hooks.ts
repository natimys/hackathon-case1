import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/shared/api/services";

export const authKey = ["auth", "me"] as const;

export function useMe() {
  return useQuery({ queryKey: authKey, queryFn: authApi.me, retry: false });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email.trim(), password),
    onSuccess: () => client.invalidateQueries({ queryKey: authKey }),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => client.clear(),
  });
}
