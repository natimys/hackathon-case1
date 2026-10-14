"use client";

import {Link, useParams} from "react-router-dom";
import {useEffect, useMemo, useRef, useState} from "react";
import * as api from "@/modules/tickets/lib/api";
import {
    useAccessScopes,
    useApartments,
    useAssignTechnician,
    useBuildings,
    useRateTicket,
    useTechnicians,
    useTicket,
    useTicketAssignments,
    useTicketAttachments,
    useTicketHistory,
    useTransitionTicket,
    useUploadAttachment
} from "@/modules/tickets/hooks/use-tickets";
import type {TicketPriority, TicketStatus} from "@/modules/tickets/types";

const statusText: Record<TicketStatus, string> = {
    new: "Новая",
    assigned: "Назначена",
    in_progress: "В работе",
    resolved: "Выполнена",
    closed: "Закрыта"
};
const priorityText: Record<TicketPriority, string> = {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
    urgent: "Срочный"
};
const statusColor: Record<TicketStatus, string> = {
    new: "bg-sky-100 text-sky-800",
    assigned: "bg-violet-100 text-violet-800",
    in_progress: "bg-amber-100 text-amber-800",
    resolved: "bg-emerald-100 text-emerald-800",
    closed: "bg-slate-100 text-slate-700"
};
const dateTime = (value: string) => new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
}).format(new Date(value));

function apiMessage(error: unknown) {
    if (typeof error === "object" && error && "response" in error) {
        const response = (error as { response?: { status?: number; data?: { detail?: unknown } } }).response;
        if (response?.status === 409) return "Заявка уже изменилась. Данные обновлены — проверьте текущий статус.";
        if (response?.status === 403) return "У вас нет прав на это действие.";
        if (response?.status === 404) return "Заявка больше недоступна. Обновите список.";
        if (response?.status === 413) return "Файл превышает допустимый размер 10 МБ.";
        if (response?.status === 415) return "Формат файла не поддерживается.";
        if (response?.status === 422 || response?.status === 400) return "Проверьте данные и требования к файлу.";
        if (response?.status === 401) return "Сессия завершена. Войдите в аккаунт снова.";
        const detail = response?.data?.detail;
        if (typeof detail === "string") return detail;
    }
    return "Не удалось выполнить действие. Попробуйте ещё раз.";
}

export function TicketDetail() {
    const params = useParams<{ id: string }>();
    const id = Number(params.id);
    const ticketQuery = useTicket(id);
    const scopeQuery = useAccessScopes();
    const buildingQuery = useBuildings();
    const apartmentQuery = useApartments(ticketQuery.data?.building_id);
    const historyQuery = useTicketHistory(id);
    const assignmentQuery = useTicketAssignments(id);
    const attachmentsQuery = useTicketAttachments(id);
    const techniciansQuery = useTechnicians(ticketQuery.data?.building_id, Boolean(scopeQuery.data?.is_platform_admin || scopeQuery.data?.scoped_roles.includes("company_admin")));
    const transition = useTransitionTicket(id);
    const assign = useAssignTechnician(id);
    const upload = useUploadAttachment(id);
    const rate = useRateTicket(id);
    const [comment, setComment] = useState("");
    const [technicianId, setTechnicianId] = useState("");
    const [message, setMessage] = useState("");
    const [busyAttachment, setBusyAttachment] = useState(false);
    const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
    const previewUrlsRef = useRef<Record<number, string>>({});
    const ticket = ticketQuery.data;
    const scopes = scopeQuery.data;
    const building = buildingQuery.data?.find((item) => item.id === ticket?.building_id);
    const apartment = apartmentQuery.data?.find((item) => item.id === ticket?.apartment_id);
    const assignments = assignmentQuery.data ?? [];
    const activeAssignment = assignments.find((item) => item.ended_at === null);
    const technicians = techniciansQuery.data ?? [];
    const activeTechnician = technicians.find((item) => item.id === activeAssignment?.technician_id);
    const isAdmin = Boolean(scopes?.is_platform_admin || scopes?.scoped_roles.includes("company_admin"));
    const isTechnician = Boolean(scopes?.is_platform_admin || (scopes?.scoped_roles.includes("technician") && activeAssignment?.technician_id === scopes.user_id));
    const isResidentOwner = Boolean(scopes && ticket?.created_by_id === scopes.user_id);
    const canAssign = Boolean(isAdmin && ticket && ["new", "assigned", "in_progress"].includes(ticket.status));
    const files = attachmentsQuery.data ?? [];
    const address = building ? `${building.city}, ${building.street}, ${building.house_number}${building.building_suffix}` : `Дом №${ticket?.building_id ?? "—"}`;

    useEffect(() => () => Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url)), []);
    useEffect(() => {
        if (window.location.search.includes("attachmentError=1")) setMessage("Заявка создана, но часть файлов не загрузилась. Прикрепите их ещё раз в карточке заявки.");
    }, []);
    const historyItems = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

    const doTransition = async (next: "in_progress" | "resolved" | "closed") => {
        setMessage("");
        if ((next === "resolved" || (next === "in_progress" && ticket?.status === "resolved") || (next === "closed" && isAdmin)) && !comment.trim()) {
            setMessage(next === "closed" ? "Добавьте комментарий для административного закрытия." : "Добавьте комментарий к изменению статуса.");
            return;
        }
        try {
            await transition.mutateAsync({status: next, comment});
            setComment("");
            setMessage("Статус заявки обновлён.");
        } catch (error) {
            setMessage(apiMessage(error));
            ticketQuery.refetch();
            historyQuery.refetch();
        }
    };
    const doAssign = async () => {
        const selectedTechnician = technicianId || (activeAssignment?.technician_id ? String(activeAssignment.technician_id) : "");
        if (!selectedTechnician) {
            setMessage("Выберите техника из списка.");
            return;
        }
        try {
            await assign.mutateAsync(Number(selectedTechnician));
            setTechnicianId("");
            setMessage("Исполнитель назначен.");
            assignmentQuery.refetch();
            historyQuery.refetch();
        } catch (error) {
            setMessage(apiMessage(error));
            ticketQuery.refetch();
            assignmentQuery.refetch();
        }
    };
    const doUpload = async (selection: FileList | null) => {
        if (!selection?.length) return;
        setBusyAttachment(true);
        setMessage("");
        for (const file of Array.from(selection)) {
            if (file.size > 10 * 1024 * 1024) {
                setMessage(`Файл «${file.name}» больше 10 МБ.`);
                continue;
            }
            try {
                await upload.mutateAsync(file);
            } catch (error) {
                setMessage(apiMessage(error));
                break;
            }
        }
        setBusyAttachment(false);
    };
    const download = async (attachmentId: number, filename: string) => {
        try {
            const blob = await api.downloadAttachment(id, attachmentId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            setMessage(apiMessage(error));
        }
    };
    const preview = async (attachmentId: number) => {
        if (previewUrls[attachmentId]) return;
        try {
            const blob = await api.downloadAttachment(id, attachmentId);
            const url = URL.createObjectURL(blob);
            previewUrlsRef.current[attachmentId] = url;
            setPreviewUrls((current) => ({...current, [attachmentId]: url}));
        } catch (error) {
            setMessage(apiMessage(error));
        }
    };

    if (ticketQuery.isLoading || scopeQuery.isLoading) return <div>
        <div/>
        <div/>
    </div>;
    if (ticketQuery.isError || !ticket) return <section><h1>Не удалось открыть заявку</h1><p>Заявка отсутствует или
        недоступна для вашего аккаунта.</p><Link to="/dashboard/tickets">К списку заявок</Link></section>;

    return <section>
        <Link to="/dashboard/tickets">К списку заявок</Link>
        <div>
            <div>
                <article>
                    <div><span>Заявка №{ticket.id}</span><span>{statusText[ticket.status]}</span></div>
                    <h1>{ticket.title}</h1><p>{address} · квартира {apartment?.number ?? ticket.apartment_id}</p>
                    <div>
                        <div><p>Приоритет</p><p>{priorityText[ticket.priority]}</p></div>
                        <div><p>Создана</p><p>{dateTime(ticket.created_at)}</p></div>
                        <div><p>Исполнитель</p>
                            <p>{activeTechnician?.name ?? (activeAssignment ? `Техник №${activeAssignment.technician_id}` : "Пока не назначен")}</p>
                        </div>
                    </div>
                    <h2>Описание проблемы</h2><p>{ticket.description}</p>
                </article>

                <article>
                    <div>
                        <h2>Вложения</h2>{!busyAttachment && ticket.status !== "closed" && (isResidentOwner || isTechnician) &&
                        <label>Добавить<input type="file" multiple
                                              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                                              onChange={(e) => doUpload(e.target.files)}/></label>}</div>
                    {busyAttachment && <p>Загружаем вложения…</p>}{attachmentsQuery.isLoading ?
                    <p>Загружаем файлы…</p> : attachmentsQuery.isError ?
                        <p>Не удалось загрузить список вложений.</p> : files.length === 0 ?
                            <p>В этой заявке пока нет вложений.</p> : <div>{files.map((file) => <div key={file.id}>
                                <button type="button"
                                        onClick={() => file.content_type.startsWith("image/") && preview(file.id)}>{previewUrls[file.id] ?
                                    <img src={previewUrls[file.id]} width={56} height={56}
                                         alt={file.original_filename}/> :
                                    <span>Вложение</span>}<span><span>{file.original_filename}</span><span>{(file.size_bytes / 1024 / 1024).toFixed(1)} МБ · {dateTime(file.created_at)}</span></span>
                                </button>
                                <button onClick={() => download(file.id, file.original_filename)}>Скачать</button>
                            </div>)}</div>}</article>

                <article><h2>История заявки</h2>{historyQuery.isLoading ?
                    <p>Загружаем историю…</p> : historyItems.length === 0 ? <p>История пока недоступна.</p> :
                        <ol>{historyItems.map((item, index) => <li key={item.id}>
                            <div><span>{index === 0 ? "Текущий статус" : "Изменение"}</span></div>
                            <div>
                                <div>
                                    <p>{item.previous_status ? `${statusText[item.previous_status]} → ${statusText[item.new_status]}` : statusText[item.new_status]}</p>
                                    <time>{dateTime(item.created_at)}</time>
                                </div>
                                {item.comment && <p>{item.comment}</p>}<p>Изменил пользователь №{item.changed_by_id}</p>
                            </div>
                        </li>)}</ol>}</article>

                {message && <div role="status">{message}</div>}
            </div>
            <aside>
                <div><h2>Действия</h2><p>Доступные действия для текущей роли.</p>
                    {canAssign && <div><p>Назначить исполнителя</p><select
                        value={technicianId || (activeAssignment?.technician_id ? String(activeAssignment.technician_id) : "")}
                        onChange={(e) => setTechnicianId(e.target.value)}>
                        <option value="">Выберите техника</option>
                        {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}</select>
                        <button disabled={!(technicianId || activeAssignment?.technician_id) || assign.isPending}
                                onClick={() => {
                                    if (!technicianId && activeAssignment?.technician_id) setTechnicianId(String(activeAssignment.technician_id));
                                    doAssign();
                                }}>{activeAssignment ? "Переназначить" : "Назначить"}</button>
                        {techniciansQuery.isError && <p>Не удалось загрузить список
                            техников.</p>}{technicians.length === 0 && !techniciansQuery.isLoading &&
                            <p>Для этого дома нет активных техников.</p>}</div>}
                    {isTechnician && ticket.status === "assigned" &&
                        <button disabled={transition.isPending} onClick={() => doTransition("in_progress")}>Принять в
                            работу</button>}
                    {isTechnician && ticket.status === "in_progress" &&
                        <div><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                                       placeholder="Что было сделано? Добавьте комментарий"/>
                            <button disabled={transition.isPending} onClick={() => doTransition("resolved")}>Отметить
                                выполнение
                            </button>
                        </div>}
                    {isTechnician && ticket.status === "resolved" &&
                        <div><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                                       placeholder="Комментарий к возврату в работу"/>
                            <button disabled={transition.isPending} onClick={() => doTransition("in_progress")}>Вернуть
                                в работу
                            </button>
                        </div>}
                    {ticket.status === "resolved" && (isResidentOwner || isAdmin) &&
                        <button disabled={transition.isPending} onClick={() => doTransition("closed")}>Закрыть
                            заявку</button>}
                    {isAdmin && ticket.status === "resolved" &&
                        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                                  placeholder="Комментарий к закрытию"/>}
                    {ticket.status === "closed" && isResidentOwner && <div><p>Оцените качество работ</p>
                        <div role="radiogroup" aria-label="Оценка заявки">{[1, 2, 3, 4, 5].map((value) => <button
                            key={value} aria-label={`${value} из 5`} onClick={() => rate.mutate(value, {
                            onSuccess: () => setMessage("Спасибо за вашу оценку."),
                            onError: (error) => setMessage(apiMessage(error))
                        })}></button>)}</div>
                        {ticket.rating && <p>Ваша оценка: {ticket.rating} из 5</p>}</div>}
                    {!canAssign && !isTechnician && !(ticket.status === "resolved" && (isResidentOwner || isAdmin)) && !(ticket.status === "closed" && isResidentOwner) &&
                        <p>Для текущего статуса действий нет.</p>}
                </div>
                <div><h2>Назначения</h2>{assignmentQuery.isLoading ? <p>Загружаем…</p> : assignments.length === 0 ?
                    <p>Назначений пока нет.</p> : <ol>{[...assignments].reverse().map((item) => {
                        const tech = technicians.find((person) => person.id === item.technician_id);
                        return <li key={item.id}>
                            <p>{tech?.name ?? `Техник №${item.technician_id}`}{item.ended_at ? " · переназначен" : " · текущий"}</p>
                            <p>{dateTime(item.assigned_at)}</p></li>;
                    })}</ol>}</div>
                <Link
                    to={ticket.status === "closed" ? "/dashboard/tickets" : "/dashboard/technician"}>{ticket.status === "closed" ? "Все заявки" : "К списку моих задач"}</Link>
            </aside>
        </div>
    </section>;
}
