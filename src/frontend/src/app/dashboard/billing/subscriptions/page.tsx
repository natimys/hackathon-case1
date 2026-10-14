"use client";

import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useEffect, useState} from "react";
import {apiClient} from "@/lib/api";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";

type Plan = {id: number; code: string; name: string; description: string; price: string; currency: string; duration_days: number; features: Record<string, boolean>};
type Subscription = {id: number; plan: string; status: string; starts_at: string | null; ends_at: string | null; price: string; features: Record<string, boolean>; notifications_enabled: boolean; event_preferences: Record<string, unknown>};
const money = (value: string) => new Intl.NumberFormat("ru-RU", {style: "currency", currency: "RUB"}).format(Number(value));
const statusLabel: Record<string, string> = {pending: "Ожидает подтверждения оплаты", active: "Активна", expired: "Срок истёк", cancelled: "Отключена"};

export default function SubscriptionsPage() {
    const client = useQueryClient();
    const plans = useQuery({queryKey: ["subscriptions", "plans"], queryFn: async () => (await apiClient.get<Plan[]>("/billing/plans")).data});
    const subscription = useQuery({queryKey: ["subscriptions", "me"], queryFn: async () => (await apiClient.get<Subscription | null>("/billing/subscriptions/me")).data});
    const scopes = useAccessScopes();
    const [message, setMessage] = useState("");
    const [motionStart, setMotionStart] = useState("");
    const [motionEnd, setMotionEnd] = useState("");
    const [zones, setZones] = useState("");
    const [editingPlan, setEditingPlan] = useState<number | null>(null);
    const [planForm, setPlanForm] = useState({code: "", name: "", description: "", price: "", duration_days: 30, motion_notifications: false, extended_archive: false, is_active: true});
    useEffect(() => {
        const prefs = subscription.data?.event_preferences;
        const interval = prefs?.motion_interval as {start?: string | null; end?: string | null} | undefined;
        if (interval) { setMotionStart(interval.start?.slice(0, 5) ?? ""); setMotionEnd(interval.end?.slice(0, 5) ?? ""); }
        if (Array.isArray(prefs?.event_zones)) setZones((prefs.event_zones as string[]).join(", "));
    }, [subscription.data]);
    const refresh = () => Promise.all([client.invalidateQueries({queryKey: ["subscriptions"]})]);
    const subscribe = useMutation({mutationFn: async (planId: number) => (await apiClient.post<{confirmation_url: string | null}>(`/billing/plans/${planId}/subscribe`, {idempotency_key: `web-sub-${planId}-${crypto.randomUUID()}`})).data, onSuccess: (result) => { if (result.confirmation_url) window.location.assign(result.confirmation_url); }});
    const savePrefs = useMutation({mutationFn: async (body: object) => (await apiClient.patch("/billing/subscriptions/me/preferences", body)).data, onSuccess: () => { setMessage("Настройки сохранены."); void refresh(); }});
    const cancel = useMutation({mutationFn: async () => (await apiClient.post("/billing/subscriptions/me/cancel")).data, onSuccess: () => { setMessage("Подписка отключена. Оплаченный срок сохранён в истории."); void refresh(); }});
    const savePlan = useMutation({mutationFn: async () => editingPlan
        ? apiClient.patch(`/billing/plans/${editingPlan}`, {...planForm, features: {motion_notifications: planForm.motion_notifications, extended_archive: planForm.extended_archive}})
        : apiClient.post("/billing/plans", {...planForm, features: {motion_notifications: planForm.motion_notifications, extended_archive: planForm.extended_archive}}), onSuccess: () => { setMessage("Тариф сохранён."); setEditingPlan(null); void plans.refetch(); }});
    const status = subscription.data?.status;
    return <section>
        <header><div><p>Дополнительные функции</p><h1>Подписки</h1><p>Разовый платёж за фиксированный срок. Автоматических списаний нет.</p></div><button onClick={() => { void plans.refetch(); void subscription.refetch(); }}>Обновить статус</button></header>
        {message && <p role="status">{message}</p>}
        {subscription.isLoading ? <p>Загрузка подписки…</p> : subscription.data ? <section>
            <h2>{subscription.data.plan}: {statusLabel[status ?? ""] ?? "Статус уточняется"}</h2>
            <p>{subscription.data.ends_at ? `Действует до ${new Date(subscription.data.ends_at).toLocaleString("ru-RU")}` : "Ожидает подтверждения оплаты"}</p>
            {status === "active" && <>
                <button onClick={() => savePrefs.mutate({notifications_enabled: !subscription.data?.notifications_enabled})}>{subscription.data.notifications_enabled ? "Отключить уведомления подписки" : "Включить уведомления подписки"}</button>
                <button onClick={() => cancel.mutate()}>Отказаться от подписки</button>
                {subscription.data.features.motion_notifications && <div>
                    <h3>Настройки движения</h3>
                    <label>С {" "}<input type="time" value={motionStart} onChange={(e) => setMotionStart(e.target.value)}/></label>
                    <label>По {" "}<input type="time" value={motionEnd} onChange={(e) => setMotionEnd(e.target.value)}/></label>
                    <label>Зоны детекции, ID через запятую {" "}<input value={zones} onChange={(e) => setZones(e.target.value)}/></label>
                    <button onClick={() => savePrefs.mutate({motion_start: motionStart || null, motion_end: motionEnd || null, event_zones: zones.split(",").map((item) => item.trim()).filter(Boolean)})}>Сохранить настройки детекции</button>
                    <p>Параметры сохраняются; доставка событий заработает после подключения реального источника детекции и зон камер.</p>
                </div>}
            </>}
        </section> : <p>Активной подписки пока нет.</p>}
        <h2>Тарифы</h2>
        {plans.isLoading ? <p>Загрузка тарифов…</p> : plans.data?.length ? plans.data.map((plan) => <article key={plan.id}>
            <h3>{plan.name}</h3><p>{plan.description}</p><p>{money(plan.price)} · {plan.duration_days} дней</p>
            {plan.features.motion_notifications && <p>Настраиваемые уведомления о движении (источник детекции ещё не подключён).</p>}
            {plan.features.extended_archive && <p>Расширенный архив: инфраструктура архива пока не подключена.</p>}
            <button disabled={subscribe.isPending} onClick={() => subscribe.mutate(plan.id)}>{status === "active" ? "Продлить" : "Подключить"}</button>
            {scopes.data?.is_platform_admin && <button onClick={() => { setEditingPlan(plan.id); setPlanForm({code: plan.code, name: plan.name, description: plan.description, price: plan.price, duration_days: plan.duration_days, motion_notifications: Boolean(plan.features.motion_notifications), extended_archive: Boolean(plan.features.extended_archive), is_active: true}); }}>Редактировать тариф</button>}
        </article>) : <p>Тарифы пока не настроены администратором.</p>}
        {scopes.data?.is_platform_admin && <form onSubmit={(event) => { event.preventDefault(); savePlan.mutate(); }}>
            <h2>{editingPlan ? "Редактировать тариф" : "Новый тариф"}</h2>
            <label>Код <input required maxLength={60} value={planForm.code} onChange={(e) => setPlanForm({...planForm, code: e.target.value})}/></label>
            <label>Название <input required maxLength={120} value={planForm.name} onChange={(e) => setPlanForm({...planForm, name: e.target.value})}/></label>
            <label>Описание <input maxLength={500} value={planForm.description} onChange={(e) => setPlanForm({...planForm, description: e.target.value})}/></label>
            <label>Цена, ₽ <input required type="number" min="0.01" step="0.01" value={planForm.price} onChange={(e) => setPlanForm({...planForm, price: e.target.value})}/></label>
            <label>Срок, дней <input required type="number" min="1" max="3660" value={planForm.duration_days} onChange={(e) => setPlanForm({...planForm, duration_days: Number(e.target.value)})}/></label>
            <label><input type="checkbox" checked={planForm.motion_notifications} onChange={(e) => setPlanForm({...planForm, motion_notifications: e.target.checked})}/>Уведомления о движении</label>
            <label><input type="checkbox" checked={planForm.extended_archive} onChange={(e) => setPlanForm({...planForm, extended_archive: e.target.checked})}/>Расширенный архив</label>
            <label><input type="checkbox" checked={planForm.is_active} onChange={(e) => setPlanForm({...planForm, is_active: e.target.checked})}/>Показывать тариф</label>
            <button disabled={savePlan.isPending}>{savePlan.isPending ? "Сохранение…" : "Сохранить тариф"}</button>
            {editingPlan && <button type="button" onClick={() => setEditingPlan(null)}>Отмена</button>}
        </form>}
        {(plans.error || subscription.error || subscribe.error || savePrefs.error || cancel.error) && <p role="alert">Не удалось выполнить запрос. Обновите страницу и повторите попытку.</p>}
    </section>;
}
