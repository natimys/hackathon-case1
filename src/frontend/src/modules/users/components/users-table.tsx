"use client";

import {Link} from "react-router-dom";
import {useDeleteUser, useUsers} from "@/modules/users/hooks/use-users";
import {UserDeleteDialog} from "@/modules/users/components/user-delete-dialog";
import {useState} from "react";
import type {UserRead} from "@/modules/users/types";

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
        return <p>Пользователи не найдены.</p>;
    }

    const totalPages = Math.ceil(data.total / data.size);
    const roleLabels: Record<string, string> = {
        admin: "Администратор",
        user: "Пользователь",
    };

    return (
        <div>
            <div className="table-scroll">
                <table>
                    <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Электронная почта</th>
                        <th>Роль</th>
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
                            <td>
                  <span
                  >
                    {user.is_active ? "Активен" : "Неактивен"}
                  </span>
                            </td>
                            <td>
                                <Link
                                    to={`/dashboard/users/${user.id}/edit`}
                                >
                                    Изменить
                                </Link>
                                <button
                                    onClick={() => setDeleteTarget(user)}
                                >
                                    Удалить
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div>
                    <p>
                        Страница {data.page} из {totalPages} (всего: {data.total})
                    </p>
                    <div>
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
