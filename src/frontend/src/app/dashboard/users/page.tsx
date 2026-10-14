import {Link} from "react-router-dom";
import {UsersTable} from "@/modules/users/components/users-table";
import {UsersAccessGate} from "@/modules/users/components/users-access-gate";

export default function UsersPage() {
    return (
        <UsersAccessGate><div>
            <div>
                <h1>Пользователи</h1>
                <Link className="button button-primary" to="/dashboard/users/new">
                    Добавить пользователя
                </Link>
            </div>
            <UsersTable/>
        </div></UsersAccessGate>
    );
}
