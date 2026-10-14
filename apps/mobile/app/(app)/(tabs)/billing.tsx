import { Link } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "@/shared/api/services";
import { useAccounts, useInvoices } from "@/features/billing/hooks";
import { useApartments } from "@/features/profile/hooks";
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, Row, Screen, SectionHeader, StatusBadge, TextField } from "@/shared/ui/components";
import { formatDate, formatMoney, formatPeriod } from "@/shared/ui/format";
import type { InvoiceStatus } from "@/shared/api/contracts";

const statusText: Record<InvoiceStatus, string> = {
  unpaid: "К оплате",
  partially_paid: "Оплачен частично",
  paid: "Оплачен",
  overdue: "Просрочен",
};
const statusTone: Record<InvoiceStatus, "success" | "warning" | "danger"> = {
  unpaid: "warning", partially_paid: "warning", paid: "success", overdue: "danger",
};

export default function BillingScreen() {
  const client = useQueryClient();
  const accounts = useAccounts();
  const invoices = useInvoices();
  const apartments = useApartments();
  const plans = useQuery({ queryKey: ["billing", "plans"], queryFn: billingApi.plans });
  const subscription = useQuery({ queryKey: ["billing", "subscription"], queryFn: billingApi.subscription });
  const [motionStart, setMotionStart] = useState("");
  const [motionEnd, setMotionEnd] = useState("");
  const [zones, setZones] = useState("");
  useEffect(() => {
    const preferences = subscription.data?.event_preferences;
    const interval = preferences?.motion_interval as { start?: string | null; end?: string | null } | undefined;
    if (interval) { setMotionStart(interval.start?.slice(0, 5) ?? ""); setMotionEnd(interval.end?.slice(0, 5) ?? ""); }
    if (Array.isArray(preferences?.event_zones)) setZones((preferences.event_zones as string[]).join(", "));
  }, [subscription.data]);
  const purchase = useMutation({ mutationFn: (planId: number) => billingApi.subscribe(planId, `mobile-sub-${planId}-${Date.now()}-${Math.random().toString(36).slice(2)}`), onSuccess: (result) => { if (result.confirmation_url) void Linking.openURL(result.confirmation_url); void client.invalidateQueries({ queryKey: ["billing", "subscription"] }); } });
  const notificationPref = useMutation({ mutationFn: (enabled: boolean) => billingApi.updateSubscriptionNotifications({ notifications_enabled: enabled }), onSuccess: () => void client.invalidateQueries({ queryKey: ["billing", "subscription"] }) });
  const saveMotionPrefs = useMutation({ mutationFn: () => billingApi.updateSubscriptionNotifications({ motion_start: motionStart || null, motion_end: motionEnd || null, event_zones: zones.split(",").map((zone) => zone.trim()).filter(Boolean) }), onSuccess: () => void client.invalidateQueries({ queryKey: ["billing", "subscription"] }) });
  const cancel = useMutation({ mutationFn: billingApi.cancelSubscription, onSuccess: () => void client.invalidateQueries({ queryKey: ["billing", "subscription"] }) });
  const loading = accounts.isLoading || invoices.isLoading;
  const error = accounts.error ?? invoices.error;

  return (
    <Screen>
      <AppText variant="title">Платежи</AppText>
      <AppText variant="muted">Начисления и история оплаты услуг дома</AppText>
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} onRetry={() => { void accounts.refetch(); void invoices.refetch(); }} /> : null}
      {!loading && !error && accounts.data?.length === 0 ? (
        <EmptyState title="Лицевых счетов пока нет" description="Обратитесь в управляющую компанию, чтобы проверить привязку квартиры." />
      ) : null}
      {accounts.data?.map((account) => (
        <Card key={account.id}>
          <AppText variant="caption">Лицевой счёт</AppText>
          <AppText variant="heading">{account.account_number}</AppText>
          <AppText variant="muted">Квартира №{apartments.data?.find((apartment) => apartment.id === account.apartment_id)?.number ?? "—"}</AppText>
        </Card>
      ))}
      <SectionHeader title="Счета" />
      {!loading && !error && invoices.data?.length === 0 ? (
        <EmptyState title="Начислений пока нет" description="Новые счета появятся здесь после загрузки данных управляющей компанией." />
      ) : null}
      {invoices.data?.map((invoice) => (
        <Link key={invoice.id} href={`/(app)/billing/${invoice.id}`} asChild>
          <Card>
            <Row><AppText variant="heading">{formatPeriod(invoice.billing_period)}</AppText><StatusBadge label={statusText[invoice.status]} tone={statusTone[invoice.status]} /></Row>
            <Row><AppText variant="muted">{invoice.status === "paid" ? "Сумма счёта" : "Остаток"}</AppText><AppText variant="heading">{formatMoney(invoice.status === "paid" ? invoice.total_amount : invoice.balance, invoice.currency)}</AppText></Row>
            <AppText variant="caption">Счёт {invoice.account_number}</AppText>
          </Card>
        </Link>
      ))}
      <SectionHeader title="Дополнительные услуги" />
      {subscription.isLoading ? <LoadingState label="Загружаем подписку…" /> : null}
      {subscription.isError ? <ErrorState error={subscription.error} onRetry={() => void subscription.refetch()} /> : null}
      {subscription.data ? <Card>
        <Row><AppText variant="heading">{subscription.data.plan}</AppText><StatusBadge label={subscription.data.status} tone={subscription.data.status === "active" ? "success" : "neutral"} /></Row>
        {subscription.data.ends_at ? <AppText variant="muted">Оплачено до {formatDate(subscription.data.ends_at)}</AppText> : null}
        {subscription.data.status === "active" ? <>
          <Button label={subscription.data.notifications_enabled ? "Отключить уведомления подписки" : "Включить уведомления подписки"} onPress={() => notificationPref.mutate(!subscription.data!.notifications_enabled)} disabled={notificationPref.isPending} secondary />
          <Button label="Отказаться от подписки" onPress={() => cancel.mutate()} disabled={cancel.isPending} secondary />
          {subscription.data.features.motion_notifications ? <>
            <TextField label="Начало интервала движения" placeholder="08:00" value={motionStart} onChangeText={setMotionStart} />
            <TextField label="Окончание интервала движения" placeholder="22:00" value={motionEnd} onChangeText={setMotionEnd} />
            <TextField label="Зоны детекции" placeholder="Идентификаторы зон через запятую" value={zones} onChangeText={setZones} />
            <Button label="Сохранить настройки детекции" onPress={() => saveMotionPrefs.mutate()} disabled={saveMotionPrefs.isPending} secondary />
            <AppText variant="muted">Настройки сохраняются. Доставка событий движения включится после подключения источника детекции и зон камеры.</AppText>
          </> : null}
        </> : null}
        <Button label="Обновить статус" onPress={() => void subscription.refetch()} disabled={subscription.isFetching} loading={subscription.isFetching} secondary />
      </Card> : null}
      {plans.data?.map((plan) => <Card key={plan.id}>
        <AppText variant="heading">{plan.name}</AppText>
        <AppText variant="muted">{plan.description}</AppText>
        <AppText variant="body">{formatMoney(plan.price, plan.currency)} за {plan.duration_days} дней</AppText>
        {plan.features.motion_notifications ? <AppText variant="caption">Уведомления о движении (при подключённой детекции)</AppText> : null}
        {plan.features.extended_archive ? <AppText variant="caption">Расширенный архив (если доступен в системе)</AppText> : null}
        <Button label="Подключить план" onPress={() => purchase.mutate(plan.id)} disabled={purchase.isPending} loading={purchase.isPending} />
      </Card>)}
      {plans.isLoading ? <LoadingState label="Загружаем доступные планы…" /> : null}
      {!plans.isLoading && !plans.isError && plans.data?.length === 0 ? <AppText variant="muted">Дополнительных планов сейчас нет.</AppText> : null}
      {plans.isError ? <ErrorState error={plans.error} onRetry={() => void plans.refetch()} /> : null}
      {purchase.isError ? <ErrorState error={purchase.error} /> : null}
    </Screen>
  );
}
