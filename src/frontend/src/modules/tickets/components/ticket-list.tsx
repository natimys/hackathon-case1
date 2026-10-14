"use client";

import {Link} from "react-router-dom";
import {useMemo, useState} from "react";
import {useAccessScopes, useApartments, useBuildings, useTickets} from "@/modules/tickets/hooks/use-tickets";
import type {TicketPriority, TicketStatus} from "@/modules/tickets/types";

const statusLabels: Record<TicketStatus, string> = {
    new: "Новая",
    assigned: "Назначена",
    in_progress: "В работе",
    resolved: "Выполнена",
    closed: "Закрыта"
};
const priorityLabels: Record<TicketPriority, string> = {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
    urgent: "Срочный"
};
const statusStyles: Record<TicketStatus, string> = {
    new: "bg-sky-50 text-sky-700 ring-sky-200",
    assigned: "bg-violet-50 text-violet-700 ring-violet-200",
    in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
    resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    closed: "bg-slate-100 text-slate-600 ring-slate-200"
};
const priorityStyles: Record<TicketPriority, string> = {
    low: "text-slate-500",
    normal: "text-sky-700",
    high: "text-orange-700",
    urgent: "text-rose-700"
};
const date = (value: string) => new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric"
}).format(new Date(value));

export function TicketList({technician = false}: { technician?: boolean }) {
    const scopes = useAccessScopes();
    const buildingsQuery = useBuildings();
    const apartmentsQuery = useApartments(undefined, true);
    const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
    const apartments = useMemo(() => new Map((apartmentsQuery.data ?? []).map((item) => [item.id, item.number])), [apartmentsQuery.data]);
    const [status, setStatus] = useState<TicketStatus | "">("");
    const [priority, setPriority] = useState<TicketPriority | "">("");
    const [buildingId, setBuildingId] = useState("");
    const [offset, setOffset] = useState(0);
    const params = {
        ...(status ? {status} : {}), ...(priority ? {priority} : {}), ...(buildingId ? {building_id: Number(buildingId)} : {}), ...(technician && scopes.data ? {assigned_to: scopes.data.user_id} : {}),
        limit: 12,
        offset
    };
    const query = useTickets(params);
    const address = useMemo(() => new Map(buildings.map((b) => [b.id, `${b.city}, ${b.street}, ${b.house_number}${b.building_suffix}`])), [buildings]);
    const nextPage = () => setOffset((current) => current + 12);
    const previousPage = () => setOffset((current) => Math.max(0, current - 12));

    return <section>
        <header>
            <div><p>Сервисный центр</p><h1>{technician ? "Мои задачи" : "Заявки"}</h1>
                <p>{technician ? "Задачи, назначенные вам, и их текущий статус." : "Обращения по домам и квартирам под вашим доступом."}</p>
            </div>
            {!technician && scopes.data?.is_resident && <Link to="/dashboard/tickets/new">Создать заявку</Link>}
        </header>

        <div>
            <div>Фильтры</div>
            <div>
                <label>Статус<select value={status} onChange={(e) => {
                    setStatus(e.target.value as TicketStatus | "");
                    setOffset(0);
                }}>
                    <option value="">Все статусы</option>
                    {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select></label>
                <label>Приоритет<select value={priority} onChange={(e) => {
                    setPriority(e.target.value as TicketPriority | "");
                    setOffset(0);
                }}>
                    <option value="">Любой приоритет</option>
                    {Object.entries(priorityLabels).map(([key, label]) => <option key={key}
                                                                                  value={key}>{label}</option>)}
                </select></label>
                {!technician && <label>Дом<select value={buildingId} onChange={(e) => {
                    setBuildingId(e.target.value);
                    setOffset(0);
                }}>
                    <option value="">Все дома</option>
                    {buildings.map((b) => <option key={b.id}
                                                  value={b.id}>{b.city}, {b.street}, {b.house_number}{b.building_suffix}</option>)}
                </select></label>}
            </div>
        </div>

        {query.isLoading || scopes.isLoading ? <p>Загружаем заявки…</p> : query.isError ?
            <div>Не удалось загрузить заявки. Проверьте соединение и попробуйте обновить
                страницу.</div> : !query.data?.items.length ?
                <div><h2>{technician ? "Назначенных задач пока нет" : "Заявок пока нет"}</h2>
                    <p>{technician ? "Когда вам назначат заявку, она появится здесь." : "Когда появятся обращения, вы увидите их в этом списке."}</p>{!technician && scopes.data?.is_resident &&
                        <Link to="/dashboard/tickets/new">Создать первую заявку </Link>}</div> : <>
                    <div>{query.data.items.map((ticket) => <Link to={`/dashboard/tickets/${ticket.id}`} key={ticket.id}>
                        <div>
                            <div>
                                <div><span>Заявка №{ticket.id}</span><span>{statusLabels[ticket.status]}</span></div>
                                <h2>{ticket.title}</h2>
                                <p>{address.get(ticket.building_id) ?? `Дом №${ticket.building_id}`} ·
                                    квартира {apartments.get(ticket.apartment_id) ?? ticket.apartment_id}</p></div>
                            <div><span>{priorityLabels[ticket.priority]}</span><span>{date(ticket.created_at)}</span>
                            </div>
                        </div>
                        <p>{ticket.description}</p></Link>)}</div>
                    <div>
                        <span>Показано {offset + 1}–{Math.min(offset + query.data.items.length, query.data.total)} из {query.data.total}</span>
                        <div>
                            <button onClick={previousPage} disabled={offset === 0}>Назад</button>
                            <button onClick={nextPage} disabled={offset + 12 >= query.data.total}>Дальше</button>
                        </div>
                    </div>
                </>}
    </section>;
}
