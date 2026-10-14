"use client";

import {useAuth} from "@/providers/auth-provider";
import {AppNavigation} from "@/components/app-navigation";
import {Outlet} from "react-router-dom";

export default function DashboardLayout() {
    const {isLoading} = useAuth();

    if (isLoading) {
        return (
            <div className="loading-state">
                <p>Загрузка…</p>
            </div>
        );
    }

    return (
        <div className="app-shell">
            <AppNavigation/>
            <main className="page-content"><Outlet/></main>
        </div>
    );
}
