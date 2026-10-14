import {useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {apiClient} from "@/lib/api";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";
import {Dialog, EmptyState, PageHeader, SectionCard, StatusBadge} from "@/components/ui";

type Plan = {id: number; code: string; name: string; description: string; price: string; currency: string; duration_days: number; features: Record<string, boolean>};
const money = (value: string) => new Intl.NumberFormat("ru-RU", {style: "currency", currency: "RUB"}).format(Number(value));
const blankPlan = {code: "", name: "", description: "", price: "", duration_days: 30, motion_notifications: false, extended_archive: false, is_active: true};

export default function SubscriptionsPage() {
    const client = useQueryClient();
    const scopes = useAccessScopes();
    const plans = useQuery({queryKey: ["subscriptions", "plans"], queryFn: async () => (await apiClient.get<Plan[]>("/billing/plans")).data});
    const [message, setMessage] = useState("");
    const [editingPlan, setEditingPlan] = useState<number | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [planForm, setPlanForm] = useState(blankPlan);
    const isPlatformAdmin = scopes.data?.is_platform_admin === true;
    const savePlan = useMutation({mutationFn: async () => {
        const body = {...planForm, features: {motion_notifications: planForm.motion_notifications, extended_archive: planForm.extended_archive}};
        return editingPlan ? apiClient.patch(`/billing/plans/${editingPlan}`, body) : apiClient.post("/billing/plans", body);
    }, onSuccess: () => {setMessage("Тариф сохранён."); setDialogOpen(false); setEditingPlan(null); void client.invalidateQueries({queryKey: ["subscriptions", "plans"]});}, onError: () => setMessage("Не удалось сохранить тариф. Проверьте данные и повторите попытку.")});

    const openNewPlan = () => {setEditingPlan(null); setPlanForm(blankPlan); setDialogOpen(true);};
    const openEditPlan = (plan: Plan) => {setEditingPlan(plan.id); setPlanForm({code: plan.code, name: plan.name, description: plan.description, price: plan.price, duration_days: plan.duration_days, motion_notifications: Boolean(plan.features.motion_notifications), extended_archive: Boolean(plan.features.extended_archive), is_active: true}); setDialogOpen(true);};
    return <div className="subscriptions-page">
        <PageHeader eyebrow="Управление услугами" title="Подписки" description="Тарифы и условия подключения дополнительных услуг." actions={isPlatformAdmin && <button type="button" className="button-primary" onClick={openNewPlan}>Добавить тариф</button>}/>
        {message && <p className="billing-message" role="status">{message}</p>}
        <SectionCard title="Тарифы" description="Доступные тарифы, которые могут подключать пользователи через мобильное приложение.">
            {plans.isLoading ? <EmptyState>Загружаем тарифы…</EmptyState> : plans.isError ? <p role="alert">Не удалось загрузить тарифы. Обновите страницу и повторите попытку.</p> : !plans.data?.length ? <EmptyState>Тарифы пока не настроены.</EmptyState> : <div className="plan-grid">{plans.data.map((plan) => <article className="plan-card" key={plan.id}><div className="plan-card-heading"><h3>{plan.name}</h3><StatusBadge tone="success">Доступен</StatusBadge></div><p>{plan.description || "Без описания"}</p><p className="plan-price">{money(plan.price)} <small>· {plan.duration_days} дней</small></p>{plan.features.motion_notifications && <p className="plan-feature">Уведомления о движении</p>}{plan.features.extended_archive && <p className="plan-feature">Расширенный архив</p>}{isPlatformAdmin && <button type="button" onClick={() => openEditPlan(plan)}>Изменить тариф</button>}</article>)}</div>}
        </SectionCard>
        {dialogOpen && <Dialog title={editingPlan ? "Изменить тариф" : "Добавить тариф"} onClose={() => setDialogOpen(false)}>
            <form className="dialog-form" onSubmit={(event) => {event.preventDefault(); savePlan.mutate();}}>
                <label>Код<input required maxLength={60} value={planForm.code} onChange={(event) => setPlanForm({...planForm, code: event.target.value})}/></label>
                <label>Название<input required maxLength={120} value={planForm.name} onChange={(event) => setPlanForm({...planForm, name: event.target.value})}/></label>
                <label>Описание<input maxLength={500} value={planForm.description} onChange={(event) => setPlanForm({...planForm, description: event.target.value})}/></label>
                <label>Цена, ₽<input required type="number" min="0.01" step="0.01" value={planForm.price} onChange={(event) => setPlanForm({...planForm, price: event.target.value})}/></label>
                <label>Срок, дней<input required type="number" min="1" max="3660" value={planForm.duration_days} onChange={(event) => setPlanForm({...planForm, duration_days: Number(event.target.value)})}/></label>
                <label className="checkbox-label"><input type="checkbox" checked={planForm.motion_notifications} onChange={(event) => setPlanForm({...planForm, motion_notifications: event.target.checked})}/>Уведомления о движении</label>
                <label className="checkbox-label"><input type="checkbox" checked={planForm.extended_archive} onChange={(event) => setPlanForm({...planForm, extended_archive: event.target.checked})}/>Расширенный архив</label>
                <label className="checkbox-label"><input type="checkbox" checked={planForm.is_active} onChange={(event) => setPlanForm({...planForm, is_active: event.target.checked})}/>Тариф доступен</label>
                <div className="dialog-actions"><button type="button" onClick={() => setDialogOpen(false)}>Отмена</button><button className="button-primary" disabled={savePlan.isPending}>{savePlan.isPending ? "Сохранение…" : "Сохранить тариф"}</button></div>
            </form>
        </Dialog>}
    </div>;
}
