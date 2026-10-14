import {useAuth} from "@/providers/auth-provider";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";
import {PageHeader, SectionCard, StatusBadge} from "@/components/ui";

export default function ProfilePage() {
    const {user, logout} = useAuth();
    const scopes = useAccessScopes();
    if (scopes.isLoading) return <p>Загружаем профиль…</p>;
    if (scopes.isError) return <div role="alert">Не удалось загрузить профиль. Повторите попытку.</div>;
    const roles = [
        ...(scopes.data?.is_platform_admin ? ["Администратор платформы"] : []),
        ...(scopes.data?.scoped_roles.includes("company_admin") ? ["Администратор управляющей компании"] : []),
    ];
    return <div className="profile-page">
        <PageHeader eyebrow="Учётная запись" title="Профиль" description="Данные администратора и его уровень доступа."/>
        <SectionCard title="Данные учётной записи">
            <dl className="profile-details"><div><dt>Имя</dt><dd>{user?.name ?? "—"}</dd></div><div><dt>Электронная почта</dt><dd>{user?.email ?? "—"}</dd></div></dl>
            <div className="profile-subsection"><h3>Роли в системе</h3><div className="role-chips">{roles.map((role) => <StatusBadge tone="success" key={role}>{role}</StatusBadge>)}</div></div>
        </SectionCard>
        <SectionCard title="Сеанс" description="Завершите текущий сеанс на этом устройстве."><button type="button" onClick={logout}>Выйти</button></SectionCard>
    </div>;
}
