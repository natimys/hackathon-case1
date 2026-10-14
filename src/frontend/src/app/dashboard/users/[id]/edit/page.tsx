"use client";

import {useParams} from "react-router-dom";
import {useUser} from "@/modules/users/hooks/use-users";
import {UserForm} from "@/modules/users/components/user-form";
import {UsersAccessGate} from "@/modules/users/components/users-access-gate";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";
import {PageHeader} from "@/components/ui";

export default function EditUserPage() {
    const params = useParams();
    const id = Number(params.id);
    const scopes = useAccessScopes();
    const {data: user, isLoading, isError} = useUser(id, scopes.data?.is_platform_admin === true);

    return (
        <UsersAccessGate>
            {isLoading ? <p>Загружаем данные пользователя…</p> : isError || !user ? <p>Пользователь не найден.</p> :
                <div><PageHeader title="Изменить пользователя"/><UserForm mode="edit" user={user}/></div>}
        </UsersAccessGate>
    );
}
