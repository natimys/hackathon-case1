import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {apiClient} from "@/lib/api";
import type {UserLogin, UserPublic, UserRegister} from "@/modules/auth/types";

export function useMe() {
    return useQuery<UserPublic>({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const {data} = await apiClient.get<UserPublic>("/auth/me/");
            return data;
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
}

export function useLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (credentials: UserLogin) => {
            const {data} = await apiClient.post("/auth/login/", credentials);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ["auth", "me"]});
        },
    });
}

export function useRegister() {
    return useMutation({
        mutationFn: async (userData: UserRegister) => {
            const {data} = await apiClient.post<UserPublic>("/auth/register/", userData);
            return data;
        },
    });
}

export function useLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await apiClient.post("/auth/logout/");
        },
        onSuccess: () => {
            queryClient.setQueryData(["auth", "me"], null);
            queryClient.clear();
        },
    });
}

export function useRefresh() {
    return useMutation({
        mutationFn: async () => {
            const {data} = await apiClient.post("/auth/refresh/");
            return data;
        },
    });
}
