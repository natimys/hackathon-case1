import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {apiClient} from "@/lib/api";
import type {UserCreate, UserRead, UsersResponse, UserUpdate} from "@/modules/users/types";

const USERS_KEY = ["users"];

export function useUsers(page = 1, size = 10) {
    return useQuery<UsersResponse>({
        queryKey: [...USERS_KEY, {page, size}],
        queryFn: async () => {
            const {data} = await apiClient.get<UsersResponse>("/users/", {
                params: {page, size},
            });
            return data;
        },
    });
}

export function useUser(id: number, enabled = true) {
    return useQuery<UserRead>({
        queryKey: [...USERS_KEY, id],
        queryFn: async () => {
            const {data} = await apiClient.get<UserRead>(`/users/${id}`);
            return data;
        },
        enabled: !!id && enabled,
    });
}

export function useCreateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userData: UserCreate) => {
            const {data} = await apiClient.post<UserRead>("/users/", userData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: USERS_KEY});
        },
    });
}

export function useUpdateUser(id: number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userData: UserUpdate) => {
            const {data} = await apiClient.patch<UserRead>(`/users/${id}`, userData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: USERS_KEY});
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            await apiClient.delete(`/users/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: USERS_KEY});
        },
    });
}
