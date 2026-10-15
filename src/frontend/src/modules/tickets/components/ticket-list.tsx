"use client";

import {Link, useSearchParams} from "react-router-dom";
import {useMemo, useState} from "react";
import {useApartments, useBuildings, useTickets} from "@/modules/tickets/hooks/use-tickets";
import type {TicketPriority, TicketStatus} from "@/modules/tickets/types";
import {FilterBar, PageHeader, SectionCard} from "@/components/ui";

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
const date = (value: string) => new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric"
}).format(new Date(value));

export function TicketList() {
    const [searchParams, setSearchParams] = useSearchParams();
    const buildingsQuery = useBuildings();
    const apartmentsQuery = useApartments(undefined, true);
    const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
    const apartments = useMemo(() => new Map((apartmentsQuery.data ?? []).map((item) => [item.id, item.number])), [apartmentsQuery.data]);
    const [status, setStatus] = useState<TicketStatus | "">(() => {
        const value = searchParams.get("status") ?? "";
        return ["new", "assigned", "in_progress", "resolved", "closed"].includes(value) ? value as TicketStatus : "";
    });
    const [priority, setPriority] = useState<TicketPriority | "">("");
    const [buildingId, setBuildingId] = useState("");
    const [offset, setOffset] = useState(0);
    const params = {
        ...(status ? {status} : {}), ...(priority ? {priority} : {}), ...(buildingId ? {building_id: Number(buildingId)} : {}),
        limit: 12,
        offset
    };
    const query = useTickets(params);
    const address = useMemo(() => new Map(buildings.map((b) => [b.id, `${b.city}, ${b.street}, ${b.house_number}${b.building_suffix}`])), [buildings]);
    const nextPage = () => setOffset((current) => current + 12);
    const previousPage = () => setOffset((current) => Math.max(0, current - 12));

    return <section className="ticket-list-page">
        <PageHeader eyebrow="Сервисный центр" title="Заявки" description="Обращения по домам и квартирам под вашими полномочиями."/>

        <div className="filter-pills" aria-label="Быстрый фильтр по статусу">
            {(["", "new", "in_progress", "resolved"] as const).map((value, index) => (
                <button type="button" key={value || "all"} aria-pressed={status === value}
                        onClick={() => { setStatus(value); setOffset(0); if (value) setSearchParams({status: value}); else setSearchParams({}); }}>
                    {["Все", "Новые", "В работе", "Выполнены"][index]}
                </button>
            ))}
        </div>

        <SectionCard title="Фильтры">
            <FilterBar className="ticket-filters">
                <label>Статус<select value={status} onChange={(e) => {
                    setStatus(e.target.value as TicketStatus | "");
                    setOffset(0);
                    if (e.target.value) setSearchParams({status: e.target.value}); else setSearchParams({});
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
                <label>Дом<select value={buildingId} onChange={(e) => {
                    setBuildingId(e.target.value);
                    setOffset(0);
                }}>
                    <option value="">Все дома</option>
                    {buildings.map((b) => <option key={b.id}
                                                  value={b.id}>{b.city}, {b.street}, {b.house_number}{b.building_suffix}</option>)}
                </select></label>
            </FilterBar>
        </SectionCard>

        {query.isLoading ? <p>Загружаем заявки…</p> : query.isError ?
            <div>Не удалось загрузить заявки. Проверьте соединение и попробуйте обновить
                страницу.</div> : !query.data?.items.length ?
                <div className="properties-empty"><h2>Заявок пока нет</h2><p>По заданным условиям заявок нет.</p></div> : <>
                    <div className="ticket-list">{query.data.items.map((ticket) => <Link className="ticket-card" to={`/dashboard/tickets/${ticket.id}`} key={ticket.id}>
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
                    <div className="ticket-pagination">
                        <span>Показано {offset + 1}–{Math.min(offset + query.data.items.length, query.data.total)} из {query.data.total}</span>
                        <div className="pagination-actions">
                            <button onClick={previousPage} disabled={offset === 0}>Назад</button>
                            <button onClick={nextPage} disabled={offset + 12 >= query.data.total}>Дальше</button>
                        </div>
                    </div>
                </>}
    </section>;
}
