"use client";

import {Link, useParams} from "react-router-dom";
import {useState} from "react";
import {apiClient} from "@/lib/api";
import {useAccessScopes} from "@/modules/tickets/hooks/use-tickets";
import {useInvoice, usePayments} from "@/modules/billing/hooks/use-billing";

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
    const [paymentMessage, setPaymentMessage] = useState("");
    const [paymentBusy, setPaymentBusy] = useState(false);

    const startPayment = async () => {
        setPaymentBusy(true);
        setPaymentMessage("");
        try {
            const result = await apiClient.post<{ confirmation_url: string }>(`/billing/invoices/${id}/payments`, {
                idempotency_key: `web-${id}-${crypto.randomUUID()}`
            });
            window.location.assign(result.data.confirmation_url);
        } catch (error) {
            const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
            setPaymentMessage(typeof detail === "string" ? detail : "Не удалось создать платёж ЮKassa.");
        } finally {
            setPaymentBusy(false);
        }
    };

    if (scopes.isLoading || invoice.isLoading) return <p>Загрузка счёта…</p>;
    if (scopes.isError || !scopes.data?.is_platform_admin && !scopes.data?.is_resident && !scopes.data?.scoped_roles.includes("company_admin")) return <div
        role="alert">Детали начислений доступны администраторам платформы и УК.</div>;
    if (invoice.isError || !invoice.data) return <div role="alert">Счёт не найден или недоступен по вашей области
        доступа.</div>;
    const data = invoice.data;
    return <section>
        <Link to="/dashboard/billing">← К биллингу</Link>
        <header><p>Счёт №{data.id} · лицевой счёт {data.account_number}</p><h1>Начисление
            за {data.billing_period.slice(0, 7)}</h1><p>Выставлен {dateTime(data.issued_at)} · срок
            оплаты {dateTime(data.due_at)}</p></header>
        <section>{[["Начислено", data.total_amount], ["Оплачено", data.paid_amount], ["Остаток", data.balance]].map(([label, value]) =>
            <div key={label}><p>{label}</p><p>{money(value, data.currency)}</p></div>)}</section>
        <section>
            <div><h2>Оплата</h2><p>Подтверждение статуса поступает от ЮKassa через серверный webhook.</p>
                <button disabled={paymentBusy || Number(data.balance) <= 0} onClick={startPayment}>{paymentBusy ? "Создаём платёж…" : "Оплатить через ЮKassa"}</button>
                <button onClick={() => { void payments.refetch(); void invoice.refetch(); }}>Обновить статус</button>
            </div>
            {paymentMessage && <p role="status">{paymentMessage}</p>}</section>
        <section><h2>Позиции начисления</h2>
            <div>
                <table>
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
                </table>
            </div>
        </section>
        <section><h2>История платежей</h2>{payments.isLoading ? <p>Загрузка платежей…</p> : payments.isError ?
            <p role="alert">Не удалось загрузить историю платежей.</p> : !payments.data?.length ?
                <p>Платежей пока нет.</p> : <div>
                    <table>
                        <thead>
                        <tr>
                            <th>Дата подтверждения</th>
                            <th>Способ</th>
                            <th>Ссылка</th>
                            <th>Сумма</th>
                            <th>Статус</th>
                        </tr>
                        </thead>
                        <tbody>{payments.data.map((payment) => <tr key={payment.id}>
                            <td>{payment.confirmed_at ? dateTime(payment.confirmed_at) : dateTime(payment.created_at)}</td>
                            <td>{payment.provider === "DEMO" || payment.provider === "DEMO_IMPORT" ? "Демонстрационный" : payment.provider}</td>
                            <td>{payment.provider_reference ?? "—"}</td>
                            <td>{money(payment.amount, payment.currency)}</td>
                            <td>{paymentStatusLabel[payment.status] ?? payment.status}</td>
                        </tr>)}</tbody>
                    </table>
                </div>}</section>
    </section>;
}
