"use client";

import type {UserRead} from "@/modules/users/types";

interface UserDeleteDialogProps {
    user: UserRead | null;
    onClose: () => void;
    onConfirm: () => void;
    isPending: boolean;
}

export function UserDeleteDialog({
                                     user,
                                     onClose,
                                     onConfirm,
                                     isPending,
                                 }: UserDeleteDialogProps) {
    if (!user) return null;

    return (
        <div>
            <div>
                <h2>Удалить пользователя</h2>
                <p>
                    Вы уверены, что хотите удалить пользователя <strong>{user.name}</strong>? Это
                    действие нельзя будет отменить.
                </p>
                <div>
                    <button
                        onClick={onClose}
                        disabled={isPending}
                    >
                        Отмена
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending ? "Удаление..." : "Удалить"}
                    </button>
                </div>
            </div>
        </div>
    );
}
