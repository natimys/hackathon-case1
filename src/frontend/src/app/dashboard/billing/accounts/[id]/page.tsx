import {Link, useParams} from "react-router-dom";
import {useMemo} from "react";
import {DataTable, EmptyState, PageHeader, SectionCard, StatusBadge} from "@/components/ui";
import {useAccount, useInvoices} from "@/modules/billing/hooks/use-billing";
import {useApartments, useBuildings} from "@/modules/tickets/hooks/use-tickets";

const money = (value: string) => new Intl.NumberFormat("ru-RU", {style: "currency", currency: "RUB"}).format(Number(value));
const periodLabel = (period: string) => {
    const [year, month] = period.slice(0, 7).split("-").map(Number);
    const label = new Intl.DateTimeFormat("ru-RU", {month: "long", year: "numeric"}).format(new Date(year, month - 1, 1));
    return label.charAt(0).toLocaleUpperCase("ru-RU") + label.slice(1);
};
const paymentLabels: Record<string, string> = {unpaid: "Не оплачен", partially_paid: "Частично оплачен", paid: "Оплачен", overdue: "Просрочен"};
const statusTone: Record<string, "neutral" | "success" | "warning" | "danger"> = {unpaid: "warning", partially_paid: "warning", paid: "success", overdue: "danger"};

export default function AccountDetailPage() {
    const {id: rawId} = useParams<{id: string}>();
    const id = Number(rawId);
    const account = useAccount(id);
    const invoices = useInvoices();
    const buildings = useBuildings();
    const apartments = useApartments(undefined, true);
    const apartment = apartments.data?.find((item) => item.id === account.data?.apartment_id);
    const building = buildings.data?.find((item) => item.id === apartment?.building_id);
    const address = building && apartment ? `${building.city}, ${building.street}, ${building.house_number}${building.building_suffix ? ` ${building.building_suffix}` : ""}, кв. ${apartment.number}` : "Адрес не найден";
    const accountInvoices = useMemo(() => (invoices.data ?? []).filter((invoice) => invoice.personal_account_id === id), [invoices.data, id]);
    if (account.isLoading) return <p>Загружаем лицевой счёт…</p>;
    if (account.isError || !account.data) return <div role="alert">Лицевой счёт не найден или недоступен в вашей области доступа.</div>;
    return <div className="account-detail-page">
        <Link to="/dashboard/billing" className="back-link">← К начислениям</Link>
        <PageHeader eyebrow="Лицевой счёт" title={`№ ${account.data.account_number}`} description={address}/>
        <SectionCard title="Состояние счёта"><div className="account-detail-summary"><div><span>Адрес</span><strong>{address}</strong></div><div><span>Источник данных</span><strong>{account.data.source_system}</strong></div><div><span>Состояние</span><StatusBadge tone={account.data.is_active ? "success" : "neutral"}>{account.data.is_active ? "Активен" : "Неактивен"}</StatusBadge></div></div></SectionCard>
        <SectionCard title="Начисления по счёту" description="Откройте начисление, чтобы посмотреть его состав и историю платежей.">
            {invoices.isLoading ? <EmptyState>Загружаем начисления…</EmptyState> : invoices.isError ? <p role="alert">Не удалось загрузить начисления.</p> : !accountInvoices.length ? <EmptyState>Начислений по этому счёту пока нет.</EmptyState> : <DataTable label="Начисления по лицевому счёту"><thead><tr><th>Период</th><th>Начислено</th><th>Оплачено</th><th>Остаток</th><th>Статус</th></tr></thead><tbody>{accountInvoices.map((invoice) => <tr key={invoice.id}><td><Link to={`/dashboard/billing/invoices/${invoice.id}`}>{periodLabel(invoice.billing_period)}</Link></td><td className="amount-cell">{money(invoice.total_amount)}</td><td className="amount-cell">{money(invoice.paid_amount)}</td><td className="amount-cell">{money(invoice.balance)}</td><td><StatusBadge tone={statusTone[invoice.status] ?? "neutral"}>{paymentLabels[invoice.status] ?? invoice.status}</StatusBadge></td></tr>)}</tbody></DataTable>}
        </SectionCard>
    </div>;
}
