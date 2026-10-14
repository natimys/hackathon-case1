import {Link} from "react-router-dom";
import {UsersTable} from "@/modules/users/components/users-table";
import {UsersAccessGate} from "@/modules/users/components/users-access-gate";
import {PageHeader, SectionCard} from "@/components/ui";

export default function UsersPage() {
    return (
        <UsersAccessGate><div className="users-page">
            <PageHeader title="Пользователи" description="Учётные записи и системные роли." actions={<Link className="button button-primary" to="/dashboard/users/new">Добавить пользователя</Link>}/>
            <SectionCard title="Список пользователей"><UsersTable/></SectionCard>
        </div></UsersAccessGate>
    );
}
