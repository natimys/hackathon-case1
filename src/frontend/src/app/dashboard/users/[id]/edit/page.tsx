"use client";

import {useParams} from "react-router-dom";
import {useUser} from "@/modules/users/hooks/use-users";
import {UserForm} from "@/modules/users/components/user-form";

export default function EditUserPage() {
    const params = useParams();
    const id = Number(params.id);
    const {data: user, isLoading, isError} = useUser(id);

    if (isLoading) {
        return <p>Loading user...</p>;
    }

    if (isError || !user) {
        return <p>User not found.</p>;
    }

    return (
        <div>
            <h1>Edit user</h1>
            <UserForm mode="edit" user={user}/>
        </div>
    );
}
