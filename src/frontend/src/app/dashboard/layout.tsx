"use client";

import {useAuth} from "@/providers/auth-provider";
import {AppNavigation} from "@/components/app-navigation";
import {Outlet} from "react-router-dom";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";

export default function DashboardLayout() {
    const {isLoading} = useAuth();
    const scopes = useAccessScopes();

    if (isLoading) {
        return (
            <div className="loading-state">
                <p>Загрузка…</p>
            </div>
        );
    }

    if (scopes.isLoading) return <div className="loading-state">Проверяем права доступа…</div>;
    if (scopes.isError) return <main className="access-denied" role="alert">Не удалось проверить права доступа. Обновите страницу или войдите снова.</main>;
    const hasAdminAccess = Boolean(scopes.data?.is_platform_admin || scopes.data?.scoped_roles.includes("company_admin"));
    if (!hasAdminAccess) return <main className="access-denied" role="alert"><h1>Доступ запрещён</h1><p>Веб-панель доступна только администраторам платформы и управляющих компаний.</p></main>;

    return (
        <div className="app-shell">
            <AppNavigation/>
            <main className="page-content"><Outlet/></main>
        </div>
    );
}
