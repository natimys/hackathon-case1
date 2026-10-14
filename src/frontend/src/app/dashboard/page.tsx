"use client";

import {useQuery} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {useAuth} from "@/providers/auth-provider";
import {useAccessScopes, useTickets} from "@/modules/tickets/hooks/use-tickets";
import * as billingApi from "@/modules/billing/lib/api";
import * as cameraApi from "@/modules/cameras/lib/api";
import {getBuildings} from "@/modules/tickets/lib/api";
import {apiClient} from "@/lib/api";
import type {TicketStatus} from "@/modules/tickets/types";

const statusLabel: Record<TicketStatus, string> = {
    new: "Новая", assigned: "Назначена", in_progress: "В работе", resolved: "Выполнена", closed: "Закрыта",
};
const money = (value: number) => new Intl.NumberFormat("ru-RU", {style: "currency", currency: "RUB", maximumFractionDigits: 0}).format(value);
const address = (building: {city: string; street: string; house_number: string; building_suffix: string}) =>
    `${building.city}, ${building.street}, ${building.house_number}${building.building_suffix ? ` ${building.building_suffix}` : ""}`;

function Empty({children}: {children: string}) { return <div className="overview-empty">{children}</div>; }
function Retry({children, onRetry}: {children: string; onRetry: () => void}) {
    return <div className="overview-empty" role="alert">{children} <button type="button" onClick={onRetry}>Повторить</button></div>;
}

function ResidentHome() {
    const tickets = useTickets({limit: 4, offset: 0});
    const cameras = useQuery({queryKey: ["cameras", "resident-home"], queryFn: cameraApi.listCameras});
    const invoices = useQuery({queryKey: ["billing", "invoices", "resident-home"], queryFn: () => billingApi.listInvoices({})});
    const subscription = useQuery({queryKey: ["subscriptions", "resident-home"], queryFn: async () => (await apiClient.get<{plan: string; status: string; ends_at: string | null} | null>("/billing/subscriptions/me")).data});
    const residentStatus: Record<string, string> = {new: "Новая", assigned: "Назначена", in_progress: "В работе", resolved: "Выполнена", closed: "Закрыта"};
    const invoiceStatus: Record<string, string> = {unpaid: "Не оплачен", partially_paid: "Оплачен частично", paid: "Оплачен", overdue: "Просрочен"};
    const subscriptionStatus: Record<string, string> = {pending: "Ожидает подтверждения", active: "Активна", expired: "Срок истёк", cancelled: "Отключена"};
    const debt = (invoices.data ?? []).reduce((total, invoice) => total + Number(invoice.balance), 0);
    return <>
        <div className="overview-intro"><div><p>Личный кабинет</p><h1>Главная</h1><p>Камеры, заявки и начисления по вашему адресу.</p></div></div>
        <div className="resident-home">
            <div className="resident-main">
                <section className="resident-panel">
                    <div className="overview-section-head"><h2>Мои камеры</h2><Link to="/dashboard/cameras">Все камеры →</Link></div>
                    {cameras.isLoading ? <Empty>Загружаем камеры…</Empty> : cameras.isError ?
                        <Retry onRetry={() => void cameras.refetch()}>Не удалось загрузить камеры.</Retry> : !cameras.data?.length ?
                            <Empty>Камеры пока не подключены.</Empty> : <>
                                <div className="camera-grid">{cameras.data.slice(0, 4).map((camera) => <article className="camera-tile" key={camera.id}>
                                    <div className="camera-screen"><span>Предпросмотр пока недоступен</span></div>
                                    <div className="camera-tile-info"><div><strong>{camera.name}</strong><small>{camera.location_description}</small></div><span className="status-pill">Включена</span></div>
                                </article>)}</div>
                                <p className="helper-text" style={{margin: "12px 0 0", fontSize: ".82rem"}}>Статус показывает, включена ли камера в системе; доступность видеопотока здесь не проверяется.</p>
                            </>}
                </section>
            </div>
            <aside className="resident-side">
                <section className="resident-panel">
                    <div className="overview-section-head"><h2>Мои заявки</h2><Link to="/dashboard/tickets">Все заявки →</Link></div>
                    {tickets.isLoading ? <Empty>Загружаем ваши заявки…</Empty> : tickets.isError ?
                        <Retry onRetry={() => void tickets.refetch()}>Не удалось загрузить заявки.</Retry> : !tickets.data?.items.length ?
                            <Empty>Заявок пока нет. Если понадобится помощь по дому, создайте обращение.</Empty> :
                            <div className="overview-list">{tickets.data.items.map((ticket) => <Link className="overview-row" key={ticket.id} to={`/dashboard/tickets/${ticket.id}`}>
                                <div className="overview-row-main"><strong>{ticket.title}</strong><small>Заявка №{ticket.id} · {new Date(ticket.created_at).toLocaleDateString("ru-RU")}</small></div>
                                <span className="status-badge">{residentStatus[ticket.status]}</span>
                            </Link>)}</div>}
                    <p style={{margin: "16px 0 0"}}><Link className="button button-primary" to="/dashboard/tickets/new">Создать заявку</Link></p>
                </section>
            </aside>
        </div>
        <div className="resident-summary">
            <section className="resident-panel">
                <div className="overview-section-head"><h2>Баланс</h2></div>
                {invoices.isLoading ? <Empty>Загружаем счета…</Empty> : invoices.isError ? <Retry onRetry={() => void invoices.refetch()}>Не удалось загрузить счета.</Retry> : !invoices.data?.length ?
                    <Empty>Начислений пока нет.</Empty> : <>
                        <p className="resident-balance">{money(debt)}</p><p className="helper-text">Остаток по счетам, доступным вам</p>
                        <div className="overview-list">{invoices.data.slice(0, 3).map((invoice) => <Link className="overview-row" key={invoice.id} to={`/dashboard/billing/invoices/${invoice.id}`}>
                            <div className="overview-row-main"><strong>Счёт за {invoice.billing_period.slice(0, 7)}</strong><small>{invoiceStatus[invoice.status] ?? "Статус уточняется"}</small></div><span className="overview-meta">{money(Number(invoice.balance))} · Открыть →</span>
                        </Link>)}</div>
                    </>}
            </section>
            <section className="resident-panel">
                <div className="overview-section-head"><h2>Подписка</h2><Link to="/dashboard/subscriptions">Управление →</Link></div>
                {subscription.isLoading ? <Empty>Загружаем подписку…</Empty> : subscription.isError ? <Retry onRetry={() => void subscription.refetch()}>Не удалось загрузить подписку.</Retry> : subscription.data ?
                    <><strong>{subscription.data.plan} · {subscriptionStatus[subscription.data.status] ?? "Статус уточняется"}</strong><p className="helper-text">{subscription.data.ends_at ? `Действует до ${new Date(subscription.data.ends_at).toLocaleDateString("ru-RU")}` : ""}</p></> :
                    <><p>Активной подписки пока нет.</p><Link to="/dashboard/subscriptions">Посмотреть тарифы →</Link></>}
            </section>
        </div>
    </>;
}

function AdminOverview() {
    const scopes = useAccessScopes();
    const buildings = useQuery({queryKey: ["properties", "buildings"], queryFn: getBuildings});
    const cameras = useQuery({queryKey: ["cameras"], queryFn: cameraApi.listCameras});
    const tickets = useTickets({limit: 6, offset: 0});
    const invoices = useQuery({queryKey: ["billing", "invoices", "overview"], queryFn: () => billingApi.listInvoices({})});
    const buildingNames = new Map((buildings.data ?? []).map((building) => [building.id, address(building)]));
    const issued = (invoices.data ?? []).reduce((total, invoice) => total + Number(invoice.total_amount), 0);
    const paid = (invoices.data ?? []).reduce((total, invoice) => total + Number(invoice.paid_amount), 0);

    return <>
        <div className="overview-intro"><div><p>Рабочая область</p><h1>Обзор системы</h1><p>Сводка по домам, оборудованию, обращениям и начислениям в пределах ваших полномочий.</p></div></div>
        <div className="overview-stack">
            <section className="overview-section">
                <div className="overview-section-head"><h2>Мои дома</h2><Link to="/dashboard/properties">Дома и доступ →</Link></div>
                {buildings.isLoading ? <Empty>Загружаем список домов…</Empty> : buildings.isError ? <Retry onRetry={() => void buildings.refetch()}>Не удалось загрузить дома.</Retry> : !buildings.data?.length ? <Empty>Дома пока не добавлены.</Empty> :
                    <div className="overview-list">{buildings.data.slice(0, 4).map((building) => <Link key={building.id} className="overview-row" to="/dashboard/properties">
                        <div className="overview-row-main"><strong>{address(building)}</strong><small>Жилой дом</small></div><span className="overview-meta">Открыть →</span>
                    </Link>)}</div>}
            </section>

            <section className="overview-section">
                <div className="overview-section-head"><h2>Оборудование</h2><Link to="/dashboard/cameras">Все камеры →</Link></div>
                {cameras.isLoading ? <Empty>Загружаем оборудование…</Empty> : cameras.isError ? <Retry onRetry={() => void cameras.refetch()}>Не удалось загрузить список камер.</Retry> : !cameras.data?.length ? <Empty>Камер пока нет.</Empty> : <>
                    <div className="overview-stat-grid">
                        <div className="overview-stat"><small>Камер зарегистрировано</small><strong>{cameras.data.length}</strong></div>
                        <div className="overview-stat"><small>Включено</small><strong>{cameras.data.filter((camera) => camera.enabled).length}</strong></div>
                        <div className="overview-stat"><small>Отключено</small><strong>{cameras.data.filter((camera) => !camera.enabled).length}</strong></div>
                    </div>
                    <p className="helper-text" style={{margin: "12px 0 0", fontSize: ".82rem"}}>Состояние означает, включена ли камера в системе; это не подтверждает доступность видеопотока.</p>
                </>}
            </section>

            <section className="overview-section">
                <div className="overview-section-head"><h2>Заявки</h2><Link to="/dashboard/tickets">Все заявки →</Link></div>
                <div className="filter-pills" aria-label="Фильтры заявок">
                    {["Все", "Новые", "В работе", "Выполнены"].map((label, index) => <Link key={label} className="button" to={`/dashboard/tickets${index ? `?status=${["", "new", "in_progress", "resolved"][index]}` : ""}`}>{label}</Link>)}
                </div>
                {tickets.isLoading ? <Empty>Загружаем последние заявки…</Empty> : tickets.isError ? <Retry onRetry={() => void tickets.refetch()}>Не удалось загрузить заявки.</Retry> : !tickets.data?.items.length ? <Empty>Заявок пока нет.</Empty> :
                    <div className="overview-list">{tickets.data.items.map((ticket) => <Link key={ticket.id} className="overview-row" to={`/dashboard/tickets/${ticket.id}`}>
                        <div className="overview-row-main"><strong>№{ticket.id} · {ticket.title}</strong><small>{buildingNames.get(ticket.building_id) ?? "Дом"} · {new Date(ticket.created_at).toLocaleDateString("ru-RU")}</small></div>
                        <span className="status-badge">{statusLabel[ticket.status]}</span>
                    </Link>)}</div>}
            </section>

            <section className="overview-section">
                <div className="overview-section-head"><h2>Биллинг</h2><Link to="/dashboard/billing">Открыть биллинг →</Link></div>
                {invoices.isLoading ? <Empty>Загружаем начисления…</Empty> : invoices.isError ? <Retry onRetry={() => void invoices.refetch()}>Не удалось загрузить начисления.</Retry> : !invoices.data?.length ? <Empty>Начислений пока нет.</Empty> :
                    <div className="overview-stat-grid"><div className="overview-stat"><small>Начислено по показанным счетам</small><strong>{money(issued)}</strong></div><div className="overview-stat"><small>Оплачено</small><strong>{money(paid)}</strong></div><div className="overview-stat"><small>Счетов</small><strong>{invoices.data.length}</strong></div></div>}
            </section>

            <section className="overview-section">
                <div className="overview-section-head"><h2>Доступ</h2><Link to={scopes.data?.is_platform_admin ? "/dashboard/users" : "/dashboard/properties"}>{scopes.data?.is_platform_admin ? "Пользователи →" : "Дома и доступ →"}</Link></div>
                <p className="helper-text">Ваша роль и уровень доступа</p>
                <div className="role-chips">{[
                    ...(scopes.data?.is_platform_admin ? ["Администратор платформы"] : []),
                    ...(scopes.data?.scoped_roles.includes("company_admin") ? ["Администратор управляющей компании"] : []),
                    ...(scopes.data?.scoped_roles.includes("technician") ? ["Техник"] : []),
                ].map((role) => <span className="role-chip" key={role}>{role}</span>)}</div>
                <p className="helper-text" style={{margin: "12px 0 0", fontSize: ".82rem"}}>Данные и действия ограничены вашей ролью и доступными домами.</p>
            </section>
        </div>
    </>;
}

export default function DashboardPage() {
    const {user} = useAuth();
    const scopes = useAccessScopes();
    if (scopes.isLoading) return <div className="loading-state">Проверяем доступ…</div>;
    if (scopes.isError) return <div role="alert">Не удалось проверить доступ. Обновите страницу и повторите попытку.</div>;
    const isAdmin = Boolean(scopes.data?.is_platform_admin || scopes.data?.scoped_roles.includes("company_admin"));
    if (isAdmin) return <AdminOverview/>;
    if (scopes.data?.is_resident) return <ResidentHome/>;
    return <>
        <div className="overview-intro"><div><p>Рабочая область</p><h1>Добро пожаловать{user ? `, ${user.name}` : ""}</h1><p>Выберите доступный раздел в меню.</p></div></div>
        {scopes.data?.scoped_roles.includes("technician") && <section className="resident-panel"><h2>Назначенные задачи</h2><p>Откройте список обращений, назначенных вам.</p><Link className="button button-primary" to="/dashboard/technician">Перейти к задачам</Link></section>}
    </>;
}
