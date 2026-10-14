"use client";

import {Link} from "react-router-dom";
import {useDeleteUser, useUsers} from "@/modules/users/hooks/use-users";
import {UserDeleteDialog} from "@/modules/users/components/user-delete-dialog";
import {useState} from "react";
import type {UserRead} from "@/modules/users/types";
import {DataTable, EmptyState, StatusBadge} from "@/components/ui";

export function UsersTable() {
    const [page, setPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<UserRead | null>(null);
    const {data, isLoading, isError} = useUsers(page);
    const deleteMutation = useDeleteUser();

    const handleDelete = () => {
        if (!deleteTarget) return;
        deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
        });
    };

    if (isLoading) {
        return <p>Загружаем пользователей…</p>;
    }

    if (isError) {
        return <p>Не удалось загрузить пользователей.</p>;
    }

    if (!data || data.data.length === 0) {
        return <EmptyState>Пользователи не найдены.</EmptyState>;
    }

    const totalPages = Math.ceil(data.total / data.size);
    const roleLabels: Record<string, string> = {
        admin: "Администратор платформы",
        user: "Пользователь",
    };

    return (
        <div>
            <DataTable label="Список пользователей">
                    <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Электронная почта</th>
                        <th>Системная роль</th>
                        <th>Статус</th>
                        <th>Действия</th>
                    </tr>
                    </thead>
                    <tbody>
                    {data.data.map((user) => (
                        <tr key={user.id}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>{roleLabels[user.role] ?? "Пользователь"}</td>
                            <td><StatusBadge tone={user.is_active ? "success" : "neutral"}>{user.is_active ? "Активен" : "Неактивен"}</StatusBadge></td>
                            <td><div className="user-actions">
                                <Link to={`/dashboard/users/${user.id}/edit`}>Изменить</Link>
                                <button type="button" className="button-danger-quiet" onClick={() => setDeleteTarget(user)}>Удалить</button>
                            </div></td>
                        </tr>
                    ))}
                    </tbody>
            </DataTable>

            {totalPages > 1 && (
                <div>
                    <p>
                        Страница {data.page} из {totalPages} (всего: {data.total})
                    </p>
                    <div className="pagination-actions">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                        >
                            Назад
                        </button>
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page >= totalPages}
                        >
                            Вперёд
                        </button>
                    </div>
                </div>
            )}

            <UserDeleteDialog
                user={deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                isPending={deleteMutation.isPending}
            />
        </div>
    );
}
