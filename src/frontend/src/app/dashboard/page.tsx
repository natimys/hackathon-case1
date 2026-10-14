import {useQuery} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {PageHeader, SectionCard, StatusBadge} from "@/components/ui";
import {useAccessScopes, useTickets} from "@/modules/tickets/hooks/use-tickets";
import * as billingApi from "@/modules/billing/lib/api";
import * as cameraApi from "@/modules/cameras/lib/api";
import {getBuildings} from "@/modules/tickets/lib/api";
import type {TicketStatus} from "@/modules/tickets/types";

const statusLabel: Record<TicketStatus, string> = {new: "Новая", assigned: "Назначена", in_progress: "В работе", resolved: "Выполнена", closed: "Закрыта"};
const money = (value: number) => new Intl.NumberFormat("ru-RU", {style: "currency", currency: "RUB", maximumFractionDigits: 0}).format(value);
const address = (building: {city: string; street: string; house_number: string; building_suffix: string}) => `${building.city}, ${building.street}, ${building.house_number}${building.building_suffix ? ` ${building.building_suffix}` : ""}`;
function Empty({children}: {children: string}) { return <div className="empty-state">{children}</div>; }
function Retry({children, onRetry}: {children: string; onRetry: () => void}) { return <div className="empty-state" role="alert">{children} <button type="button" onClick={onRetry}>Повторить</button></div>; }

export default function DashboardPage() {
    const scopes = useAccessScopes();
    const buildings = useQuery({queryKey: ["properties", "buildings"], queryFn: getBuildings});
    const cameras = useQuery({queryKey: ["cameras"], queryFn: cameraApi.listCameras});
    const tickets = useTickets({limit: 6, offset: 0});
    const invoices = useQuery({queryKey: ["billing", "invoices", "overview"], queryFn: () => billingApi.listInvoices({})});
    const buildingNames = new Map((buildings.data ?? []).map((building) => [building.id, address(building)]));
    const issued = (invoices.data ?? []).reduce((total, invoice) => total + Number(invoice.total_amount), 0);
    const paid = (invoices.data ?? []).reduce((total, invoice) => total + Number(invoice.paid_amount), 0);
    if (scopes.isLoading) return <div className="loading-state">Загружаем обзор…</div>;
    if (scopes.isError) return <div role="alert">Не удалось загрузить права доступа.</div>;
    return <div className="admin-overview">
        <PageHeader eyebrow="Рабочая область" title="Обзор системы" description="Состояние домов, оборудования, заявок и начислений в пределах ваших полномочий."/>
        <div className="overview-stack">
            <SectionCard title="Дома" actions={<Link to="/dashboard/properties">Дома и доступ →</Link>}>
                {buildings.isLoading ? <Empty>Загружаем список домов…</Empty> : buildings.isError ? <Retry onRetry={() => void buildings.refetch()}>Не удалось загрузить дома.</Retry> : !buildings.data?.length ? <Empty>Дома пока не добавлены.</Empty> : <div className="overview-list">{buildings.data.slice(0, 4).map((building) => <Link key={building.id} className="overview-row" to="/dashboard/properties"><div className="overview-row-main"><strong>{address(building)}</strong><small>Жилой дом</small></div><span className="overview-meta">Открыть →</span></Link>)}</div>}
            </SectionCard>
            <SectionCard title="Камеры и оборудование" actions={<Link to="/dashboard/cameras">Все камеры →</Link>}>
                {cameras.isLoading ? <Empty>Загружаем оборудование…</Empty> : cameras.isError ? <Retry onRetry={() => void cameras.refetch()}>Не удалось загрузить список камер.</Retry> : !cameras.data?.length ? <Empty>Камер пока нет.</Empty> : <div className="overview-stat-grid"><div className="overview-stat"><small>Зарегистрировано</small><strong>{cameras.data.length}</strong></div><div className="overview-stat"><small>Включено</small><strong>{cameras.data.filter((camera) => camera.enabled).length}</strong></div><div className="overview-stat"><small>Отключено</small><strong>{cameras.data.filter((camera) => !camera.enabled).length}</strong></div></div>}
            </SectionCard>
            <SectionCard title="Заявки" actions={<Link to="/dashboard/tickets">Все заявки →</Link>}>
                <div className="filter-pills" aria-label="Быстрый фильтр по статусу">{["Все", "Новые", "В работе", "Выполнены"].map((label, index) => <Link key={label} className="button" to={`/dashboard/tickets${index ? `?status=${["", "new", "in_progress", "resolved"][index]}` : ""}`}>{label}</Link>)}</div>
                {tickets.isLoading ? <Empty>Загружаем последние заявки…</Empty> : tickets.isError ? <Retry onRetry={() => void tickets.refetch()}>Не удалось загрузить заявки.</Retry> : !tickets.data?.items.length ? <Empty>Заявок пока нет.</Empty> : <div className="overview-list">{tickets.data.items.map((ticket) => <Link key={ticket.id} className="overview-row" to={`/dashboard/tickets/${ticket.id}`}><div className="overview-row-main"><strong>№{ticket.id} · {ticket.title}</strong><small>{buildingNames.get(ticket.building_id) ?? "Дом"} · {new Date(ticket.created_at).toLocaleDateString("ru-RU")}</small></div><StatusBadge>{statusLabel[ticket.status]}</StatusBadge></Link>)}</div>}
            </SectionCard>
            <SectionCard title="Начисления" actions={<Link to="/dashboard/billing">Открыть биллинг →</Link>}>
                {invoices.isLoading ? <Empty>Загружаем начисления…</Empty> : invoices.isError ? <Retry onRetry={() => void invoices.refetch()}>Не удалось загрузить начисления.</Retry> : !invoices.data?.length ? <Empty>Начислений пока нет.</Empty> : <div className="overview-stat-grid"><div className="overview-stat"><small>Начислено по выборке</small><strong>{money(issued)}</strong></div><div className="overview-stat"><small>Оплачено</small><strong>{money(paid)}</strong></div><div className="overview-stat"><small>Начислений</small><strong>{invoices.data.length}</strong></div></div>}
            </SectionCard>
            <SectionCard title="Полномочия" actions={<Link to={scopes.data?.is_platform_admin ? "/dashboard/users" : "/dashboard/properties"}>{scopes.data?.is_platform_admin ? "Пользователи →" : "Дома и доступ →"}</Link>}>
                <div className="role-chips">{[...(scopes.data?.is_platform_admin ? ["Администратор платформы"] : []), ...(scopes.data?.scoped_roles.includes("company_admin") ? ["Администратор управляющей компании"] : [])].map((role) => <StatusBadge tone="success" key={role}>{role}</StatusBadge>)}</div>
                <p className="helper-text overview-footnote">Данные и действия ограничены вашей ролью и доступными домами.</p>
            </SectionCard>
        </div>
    </div>;
}
