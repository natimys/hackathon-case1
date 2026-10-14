import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { AppText, Button, Card, ErrorState, LoadingState, Row, Screen, SectionHeader, StatusBadge } from "@/shared/ui/components";
import { formatDate, formatMoney, formatPeriod } from "@/shared/ui/format";
import { usePayment, useInvoice, usePayments } from "@/features/billing/hooks";
import { theme } from "@/shared/config/theme";

const paymentStatusLabel: Record<string, string> = { pending: "Ожидает подтверждения", succeeded: "Оплачен", cancelled: "Отменён", canceled: "Отменён", failed: "Ошибка" };
const invoiceStatusLabel: Record<string, string> = { unpaid: "К оплате", partially_paid: "Оплачен частично", paid: "Оплачен", overdue: "Просрочен" };

export default function InvoiceScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = Number(rawId);
  const invoice = useInvoice(id);
  const payments = usePayments(id);
  const payment = usePayment(id);

  if (invoice.isLoading) return <Screen><LoadingState /></Screen>;
  if (invoice.isError || !invoice.data) return <Screen><ErrorState error={invoice.error ?? new Error("Счёт не найден.")} onRetry={() => void invoice.refetch()} /></Screen>;

  const record = invoice.data;
  return (
    <Screen>
      <AppText variant="title">Счёт за {formatPeriod(record.billing_period)}</AppText>
      <Card>
        <Row><AppText variant="muted">Статус</AppText><StatusBadge label={invoiceStatusLabel[record.status] ?? record.status} tone={record.status === "paid" ? "success" : record.status === "overdue" ? "danger" : "warning"} /></Row>
        <AppText variant="caption">К оплате</AppText>
        <AppText variant="amount" style={{ fontSize: 30, color: theme.colors.brand.strong }}>{formatMoney(record.balance, record.currency)}</AppText>
        <Row><AppText variant="muted">Начислено</AppText><AppText variant="body">{formatMoney(record.total_amount, record.currency)}</AppText></Row>
        <Row><AppText variant="muted">Оплачено</AppText><AppText variant="body">{formatMoney(record.paid_amount, record.currency)}</AppText></Row>
        <AppText variant="caption">Срок оплаты: {formatDate(record.due_at)}</AppText>
      </Card>
      <SectionHeader title="Состав счёта" />
      {record.items.map((item) => (
        <Card key={item.id}>
          <AppText variant="heading">{item.description}</AppText>
          <Row><AppText variant="muted">{item.quantity} × {formatMoney(item.unit_price, record.currency)}</AppText><AppText variant="body">{formatMoney(item.amount, record.currency)}</AppText></Row>
        </Card>
      ))}
      <SectionHeader title="История платежей" />
      {payments.isLoading ? <LoadingState /> : null}
      {payments.isError ? <ErrorState error={payments.error} onRetry={() => void payments.refetch()} /> : null}
      {!payments.isLoading && !payments.isError && payments.data?.length === 0 ? <AppText variant="muted">Платежей пока нет.</AppText> : null}
      {payments.data?.map((payment) => (
        <Card key={payment.id}>
          <Row><AppText variant="heading">{formatMoney(payment.amount, payment.currency)}</AppText><StatusBadge label={paymentStatusLabel[payment.status] ?? payment.status} tone={payment.status === "succeeded" ? "success" : payment.status === "failed" || payment.status === "cancelled" || payment.status === "canceled" ? "danger" : "warning"} /></Row>
          <AppText variant="caption">{formatDate(payment.created_at)} · {payment.provider}</AppText>
        </Card>
      ))}
      {Number(record.balance) > 0 ? (
        <Card>
          <AppText variant="muted">Оплата откроется на защищённой странице ЮKassa. Состояние обновится после подтверждения сервером.</AppText>
          {payment.isError ? <ErrorState error={payment.error} /> : null}
          {payment.isSuccess ? <AppText variant="body">Статус: {paymentStatusLabel[payment.data.status] ?? "Платёж создан"}. Подтверждение придёт после обработки на сервере.</AppText> : null}
          <Button label="Оплатить через ЮKassa" onPress={() => payment.mutate(undefined, { onSuccess: (result) => { if (result.confirmation_url) void Linking.openURL(result.confirmation_url); } })} disabled={payment.isPending} loading={payment.isPending} />
          <AppText variant="caption">Вы перейдёте на защищённую страницу платёжного провайдера. Мы обновим статус после подтверждения сервером.</AppText>
          <Button label="Обновить статус" onPress={() => { void payments.refetch(); void invoice.refetch(); }} disabled={payments.isFetching || invoice.isFetching} loading={payments.isFetching || invoice.isFetching} secondary />
        </Card>
      ) : null}
    </Screen>
  );
}
