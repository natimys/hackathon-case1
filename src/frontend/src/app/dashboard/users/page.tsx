import {Link} from "react-router-dom";
import {UsersTable} from "@/modules/users/components/users-table";

export default function UsersPage() {
    return (
        <div>
            <div>
                <h1>Пользователи</h1>
                <Link
                    to="/dashboard/users/new"
                >
                    Добавить пользователя
                </Link>
            </div>
            <UsersTable/>
        </div>
    );
}
