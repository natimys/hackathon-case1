"use client";

import type {UserRead} from "@/modules/users/types";
import {Dialog} from "@/components/ui";

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
        <Dialog title="Удалить пользователя" onClose={onClose}>
                <p className="dialog-description">
                    Вы уверены, что хотите удалить пользователя <strong>{user.name}</strong>? Это
                    действие нельзя будет отменить.
                </p>
                <div className="dialog-actions">
                    <button
                        onClick={onClose}
                        disabled={isPending}
                    >
                        Отмена
                    </button>
                    <button className="button-danger"
                        type="button"
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending ? "Удаление…" : "Удалить"}
                    </button>
                </div>
        </Dialog>
    );
}
