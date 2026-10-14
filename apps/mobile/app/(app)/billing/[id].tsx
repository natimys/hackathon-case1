import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { AppText, Button, Card, ErrorState, LoadingState, Row, Screen } from "@/shared/ui/components";
import { formatDate, formatMoney, formatPeriod } from "@/shared/ui/format";
import { usePayment, useInvoice, usePayments } from "@/features/billing/hooks";

const paymentStatusLabel: Record<string, string> = { pending: "Ожидает подтверждения", succeeded: "Оплачен", cancelled: "Отменён", canceled: "Отменён", failed: "Ошибка" };

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
        <Row><AppText variant="muted">Статус</AppText><AppText variant="heading">{record.status.replaceAll("_", " ")}</AppText></Row>
        <Row><AppText variant="muted">Начислено</AppText><AppText variant="body">{formatMoney(record.total_amount, record.currency)}</AppText></Row>
        <Row><AppText variant="muted">Оплачено</AppText><AppText variant="body">{formatMoney(record.paid_amount, record.currency)}</AppText></Row>
        <Row><AppText variant="heading">Остаток</AppText><AppText variant="heading">{formatMoney(record.balance, record.currency)}</AppText></Row>
        <AppText variant="muted">Оплатить до {formatDate(record.due_at)}</AppText>
      </Card>
      <AppText variant="heading">Начисления</AppText>
      {record.items.map((item) => (
        <Card key={item.id}>
          <AppText variant="heading">{item.description}</AppText>
          <Row><AppText variant="muted">{item.quantity} × {formatMoney(item.unit_price, record.currency)}</AppText><AppText variant="body">{formatMoney(item.amount, record.currency)}</AppText></Row>
        </Card>
      ))}
      <AppText variant="heading">История платежей</AppText>
      {payments.isLoading ? <LoadingState /> : null}
      {payments.isError ? <ErrorState error={payments.error} onRetry={() => void payments.refetch()} /> : null}
      {!payments.isLoading && !payments.isError && payments.data?.length === 0 ? <AppText variant="muted">Платежей пока нет.</AppText> : null}
      {payments.data?.map((payment) => (
        <Card key={payment.id}>
          <Row><AppText variant="body">{formatMoney(payment.amount, payment.currency)}</AppText><AppText variant="muted">{paymentStatusLabel[payment.status] ?? payment.status}</AppText></Row>
          <AppText variant="caption">{formatDate(payment.created_at)} · {payment.provider}</AppText>
        </Card>
      ))}
      {Number(record.balance) > 0 ? (
        <Card>
          <AppText variant="muted">Оплата откроется на защищённой странице ЮKassa. Состояние обновится после подтверждения сервером.</AppText>
          {payment.isError ? <ErrorState error={payment.error} /> : null}
          {payment.isSuccess ? <AppText variant="body">Статус: {payment.data.status}. Подтверждение придёт после webhook.</AppText> : null}
          <Button label={payment.isPending ? "Создаём платёж…" : "Оплатить через ЮKassa"} onPress={() => payment.mutate(undefined, { onSuccess: (result) => { if (result.confirmation_url) void Linking.openURL(result.confirmation_url); } })} disabled={payment.isPending} />
          <Button label="Обновить статус" onPress={() => { void payments.refetch(); void invoice.refetch(); }} disabled={payments.isFetching || invoice.isFetching} />
        </Card>
      ) : null}
    </Screen>
  );
}
