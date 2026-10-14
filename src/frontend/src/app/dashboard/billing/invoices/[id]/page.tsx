"use client";

import {Link, useParams} from "react-router-dom";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";
import {useInvoice, usePayments} from "@/modules/billing/hooks/use-billing";
import {DataTable, PageHeader, SectionCard, StatusBadge} from "@/components/ui";

const money = (value: string, currency: string) => new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency
}).format(Number(value));
const dateTime = (value: string) => new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
}).format(new Date(value));
const paymentStatusLabel: Record<string, string> = {pending: "Ожидает подтверждения", succeeded: "Оплачен", cancelled: "Отменён", canceled: "Отменён", failed: "Ошибка"};

export default function InvoiceDetailPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params.id);
    const scopes = useAccessScopes();
    const invoice = useInvoice(id);
    const payments = usePayments(id);
    if (scopes.isLoading || invoice.isLoading) return <p>Загрузка счёта…</p>;
    if (scopes.isError || !scopes.data?.is_platform_admin && !scopes.data?.scoped_roles.includes("company_admin")) return <div role="alert">Детали начислений доступны администраторам платформы и УК.</div>;
    if (invoice.isError || !invoice.data) return <div role="alert">Счёт не найден или недоступен по вашей области
        доступа.</div>;
    const data = invoice.data;
    return <section>
        <Link to="/dashboard/billing">← К биллингу</Link>
        <PageHeader eyebrow={`Начисление №${data.id} · лицевой счёт ${data.account_number}`} title={`Начисление за ${new Intl.DateTimeFormat("ru-RU", {month: "long", year: "numeric"}).format(new Date(`${data.billing_period.slice(0, 7)}-01`))}`} description={`Выставлено ${dateTime(data.issued_at)} · срок оплаты ${dateTime(data.due_at)}`} actions={<button type="button" onClick={() => {void payments.refetch(); void invoice.refetch();}}>Обновить статус</button>}/>
        <div className="invoice-totals">{[["Начислено", data.total_amount], ["Оплачено", data.paid_amount], ["Остаток", data.balance]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value, data.currency)}</strong></div>)}</div>
        <SectionCard title="Позиции начисления"><DataTable label="Позиции начисления">
                    <thead>
                    <tr>
                        <th>Услуга</th>
                        <th>Кол-во</th>
                        <th>Цена</th>
                        <th>Сумма</th>
                    </tr>
                    </thead>
                    <tbody>{data.items.map((item) => <tr key={item.id}>
                        <td>
                            <div>{item.description}</div>
                            <div>{item.service_code}</div>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{money(item.unit_price, data.currency)}</td>
                        <td>{money(item.amount, data.currency)}</td>
                    </tr>)}</tbody>
                </DataTable></SectionCard>
        <SectionCard title="История платежей">{payments.isLoading ? <p>Загрузка платежей…</p> : payments.isError ?
            <p role="alert">Не удалось загрузить историю платежей.</p> : !payments.data?.length ?
            <p>Платежей пока нет.</p> : <DataTable label="История платежей">
                        <thead>
                        <tr>
                            <th>Дата подтверждения</th>
                            <th>Способ</th>
                            <th>Сумма</th>
                            <th>Статус</th>
                        </tr>
                        </thead>
                        <tbody>{payments.data.map((payment) => <tr key={payment.id}>
                            <td>{payment.confirmed_at ? dateTime(payment.confirmed_at) : dateTime(payment.created_at)}</td>
                            <td>{payment.provider === "yookassa" ? "ЮKassa" : payment.provider === "DEMO" || payment.provider === "DEMO_IMPORT" ? "Демонстрационный" : "Платёжный сервис"}</td>
                            <td>{money(payment.amount, payment.currency)}</td>
                            <td><StatusBadge>{paymentStatusLabel[payment.status] ?? "Статус уточняется"}</StatusBadge></td>
                        </tr>)}</tbody>
                    </DataTable>}</SectionCard>
    </section>;
}
