import {UserForm} from "@/modules/users/components/user-form";
import {UsersAccessGate} from "@/modules/users/components/users-access-gate";

export default function NewUserPage() {
    return (
        <UsersAccessGate><div>
            <h1>Новый пользователь</h1>
            <UserForm mode="create"/>
        </div></UsersAccessGate>
    );
}
