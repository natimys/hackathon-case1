"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {apiClient} from "@/lib/api";
import {useAuth} from "@/providers/auth-provider";
import {useAccessScopes, useApartments, useBuildings} from "@/modules/tickets/hooks/use-tickets";
import {listCameras} from "@/modules/cameras/lib/api";

interface NotificationPreferences {
    timezone: string;
    quiet_start: string | null;
    quiet_end: string | null;
    camera_offline_enabled: boolean;
    ticket_status_enabled: boolean;
}

export default function ProfilePage() {
    const {user, logout} = useAuth();
    const scopes = useAccessScopes();
    const buildings = useBuildings();
    const apartments = useApartments(undefined, Boolean(scopes.data?.is_resident));
    const cameras = useQuery({queryKey: ["cameras", "profile"], queryFn: listCameras, enabled: Boolean(scopes.data)});
    const preferences = useQuery({queryKey: ["notifications", "preferences"], queryFn: async () => (await apiClient.get<NotificationPreferences>("/notifications/preferences")).data});
    const client = useQueryClient();
    const save = useMutation({
        mutationFn: async (body: Omit<NotificationPreferences, "timezone">) => (await apiClient.patch<NotificationPreferences>("/notifications/preferences", {...body, timezone: preferences.data?.timezone ?? "Asia/Yakutsk"})).data,
        onSuccess: () => client.invalidateQueries({queryKey: ["notifications", "preferences"]}),
    });
    const buildingLabels = new Map((buildings.data ?? []).map((building) => [building.id, `${building.city}, ${building.street}, ${building.house_number}${building.building_suffix ? ` ${building.building_suffix}` : ""}`]));
    const initials = user?.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU")).join("") || "ДД";

    const submitPreferences = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        save.mutate({
            quiet_start: String(values.get("quiet_start") || "") || null,
            quiet_end: String(values.get("quiet_end") || "") || null,
            camera_offline_enabled: values.get("camera_offline_enabled") === "on",
            ticket_status_enabled: values.get("ticket_status_enabled") === "on",
        });
    };

    if (scopes.isLoading) return <p>Загружаем профиль…</p>;
    if (scopes.isError) return <div role="alert">Не удалось загрузить профиль. Повторите попытку.</div>;
    const roles = [
        ...(scopes.data?.is_platform_admin ? ["Администратор платформы"] : []),
        ...(scopes.data?.scoped_roles.includes("company_admin") ? ["Администратор управляющей компании"] : []),
        ...(scopes.data?.scoped_roles.includes("technician") ? ["Техник"] : []),
        ...(scopes.data?.is_resident ? ["Житель"] : []),
    ];

    return <section>
        <header><div><p>Учётная запись</p><h1>Профиль</h1><p>Личные данные, доступ по адресам и настройки уведомлений.</p></div></header>
        <div className="profile-layout">
            <div className="profile-column">
                <section className="resident-panel">
                    <div className="profile-person"><div className="profile-avatar" aria-hidden="true">{initials}</div><div><h2>{user?.name ?? "Пользователь"}</h2><p>{user?.email ?? ""}</p></div></div>
                    <div className="profile-subsection"><h3>Права доступа</h3><div className="role-chips">{roles.map((role) => <span className="role-chip" key={role}>{role}</span>)}</div></div>
                    <div className="profile-subsection"><h3>Мои адреса</h3>
                        {buildings.isLoading ? <p className="helper-text">Загружаем адреса…</p> : buildings.isError ? <p className="helper-text">Не удалось загрузить адреса.</p> : !buildings.data?.length ? <p className="helper-text">Адреса пока не привязаны.</p> :
                            <ul className="profile-addresses">{buildings.data.map((building) => <li key={building.id}><strong>{buildingLabels.get(building.id)}</strong>
                                {scopes.data?.is_resident && <small>{(apartments.data ?? []).filter((apartment) => apartment.building_id === building.id).map((apartment) => `Квартира ${apartment.number}`).join(" · ") || "Подтверждённая привязка"}</small>}
                            </li>)}</ul>}
                    </div>
                    {scopes.data?.is_resident && <div className="profile-subsection"><h3>Доступные камеры</h3>{cameras.isLoading ? <p className="helper-text">Загружаем камеры…</p> : cameras.isError ? <p className="helper-text">Не удалось загрузить камеры.</p> : !cameras.data?.length ? <p className="helper-text">Камер по вашим адресам пока нет.</p> : <p>{cameras.data.length} камер по вашим адресам · <Link to="/dashboard/cameras">Открыть камеры →</Link></p>}</div>}
                </section>
            </div>
            <div className="profile-column">
                <section className="resident-panel"><h2>Уведомления</h2>
                    {preferences.isLoading ? <p className="helper-text">Загружаем настройки…</p> : preferences.isError || !preferences.data ? <div role="alert">Не удалось загрузить настройки уведомлений. Обновите страницу.</div> : <form onSubmit={submitPreferences}>
                        <label className="setting-row"><span><strong>Камера не в сети</strong><small>Сообщать, если камера потеряла связь.</small></span><input type="checkbox" name="camera_offline_enabled" defaultChecked={preferences.data.camera_offline_enabled}/></label>
                        <label className="setting-row"><span><strong>Статус заявки</strong><small>Сообщать об изменении статуса обращения.</small></span><input type="checkbox" name="ticket_status_enabled" defaultChecked={preferences.data.ticket_status_enabled}/></label>
                        <div className="profile-quiet-hours"><h3>Тихие часы</h3><p className="helper-text">Часовой пояс: {preferences.data.timezone}</p><div className="quiet-hour-fields"><label>С<input type="time" name="quiet_start" defaultValue={preferences.data.quiet_start?.slice(0, 5) ?? ""}/></label><label>До<input type="time" name="quiet_end" defaultValue={preferences.data.quiet_end?.slice(0, 5) ?? ""}/></label></div></div>
                        <button type="submit" disabled={save.isPending}>{save.isPending ? "Сохраняем…" : "Сохранить настройки"}</button>
                        {save.isSuccess && <p role="status">Настройки сохранены.</p>}{save.isError && <p role="alert">Не удалось сохранить настройки. Проверьте значения и попробуйте ещё раз.</p>}
                    </form>}
                </section>
                <section className="resident-panel"><h2>Подписка</h2><p>Тарифы, срок действия и оплата.</p><Link to="/dashboard/subscriptions">Открыть подписки →</Link></section>
                <section className="resident-panel profile-exit"><div><h2>Выйти из учётной записи</h2><p>Вы сможете войти снова в любое время.</p></div><button type="button" onClick={logout}>Выйти</button></section>
            </div>
        </div>
    </section>;
}
