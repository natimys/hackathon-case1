import type {ReactNode} from "react";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";

export function UsersAccessGate({children}: {children: ReactNode}) {
    const scopes = useAccessScopes();
    if (scopes.isLoading) return <p>Проверяем доступ…</p>;
    if (scopes.isError) return <div role="alert">Не удалось проверить доступ. Обновите страницу и повторите попытку.</div>;
    if (!scopes.data?.is_platform_admin) return <div role="alert">Управление пользователями доступно только администратору платформы.</div>;
    return <>{children}</>;
}
