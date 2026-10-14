"use client";

import {useAuth} from "@/providers/auth-provider";

export default function DashboardPage() {
    const {user} = useAuth();

    return (
        <div>
            <h1>Обзор</h1>
            <p>
                Добро пожаловать{user ? `, ${user.name}` : ""}. Выберите раздел в меню.
            </p>
        </div>
    );
}
