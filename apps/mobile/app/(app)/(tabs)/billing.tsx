import { Link } from "expo-router";
import { useAccounts, useInvoices } from "@/features/billing/hooks";
import { useApartments } from "@/features/profile/hooks";
import { AppText, Card, EmptyState, ErrorState, LoadingState, Row, Screen } from "@/shared/ui/components";
import { formatMoney, formatPeriod } from "@/shared/ui/format";
import type { InvoiceStatus } from "@/shared/api/contracts";

const statusText: Record<InvoiceStatus, string> = {
  unpaid: "К оплате",
  partially_paid: "Оплачен частично",
  paid: "Оплачен",
  overdue: "Просрочен",
};

export default function BillingScreen() {
  const accounts = useAccounts();
  const invoices = useInvoices();
  const apartments = useApartments();
  const loading = accounts.isLoading || invoices.isLoading;
  const error = accounts.error ?? invoices.error;

  return (
    <Screen>
      <AppText variant="title">Счета</AppText>
      <AppText variant="muted">Лицевые счета и начисления из вашего аккаунта</AppText>
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
      <AppText variant="heading">Начисления</AppText>
      {!loading && !error && invoices.data?.length === 0 ? (
        <EmptyState title="Начислений пока нет" description="Новые счета появятся здесь после загрузки данных управляющей компанией." />
      ) : null}
      {invoices.data?.map((invoice) => (
        <Link key={invoice.id} href={`/(app)/billing/${invoice.id}`} asChild>
          <Card>
            <Row><AppText variant="heading">{formatPeriod(invoice.billing_period)}</AppText><AppText variant="muted">{statusText[invoice.status]}</AppText></Row>
            <Row><AppText variant="muted">Счёт {invoice.account_number}</AppText><AppText variant="heading">{formatMoney(invoice.balance, invoice.currency)}</AppText></Row>
          </Card>
        </Link>
      ))}
    </Screen>
  );
}
