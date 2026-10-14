"use client";

import {Link} from "react-router-dom";
import {useMemo, useState} from "react";
import {useAccessScopes, useApartments, useBuildings} from "@/modules/tickets/hooks/use-tickets";
import {
    useAccounts,
    useCreateAccount,
    useGenerateAccrual,
    useImportPayments,
    useInvoices
} from "@/modules/billing/hooks/use-billing";
import * as billingApi from "@/modules/billing/lib/api";
import type {PaymentImportReport} from "@/modules/billing/types";

const money = (value: string) => new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB"
}).format(Number(value));
const currentPeriod = new Date().toISOString().slice(0, 7) + "-01";
const statusLabel: Record<string, string> = {
    unpaid: "Не оплачен",
    partially_paid: "Частично оплачен",
    paid: "Оплачен",
    overdue: "Просрочен"
};

function errorText(error: unknown) {
    const status = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response?.status;
    if (status === 401) return "Сессия завершена. Войдите снова.";
    if (status === 403) return "У вас нет прав на это действие.";
    if (status === 409) return "Конфликт данных. Возможно, начисление за этот период уже создано.";
    if (status === 422) return "Проверьте введённые данные и формат файла.";
    if (status === 503) return "Импорт реестра временно недоступен.";
    return "Не удалось выполнить запрос. Повторите попытку.";
}

export default function BillingPage() {
    const scopes = useAccessScopes();
    const buildingsQuery = useBuildings();
    const accountsQuery = useAccounts();
    const [state, setState] = useState("");
    const [periodFilter, setPeriodFilter] = useState("");
    const [buildingFilter, setBuildingFilter] = useState("");
    const invoicesQuery = useInvoices({...(state ? {state} : {}), ...(periodFilter ? {period: `${periodFilter}-01`} : {}), ...(buildingFilter ? {building_id: Number(buildingFilter)} : {})});
    const [message, setMessage] = useState("");
    const [accrualOpen, setAccrualOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);
    const [invoicePeriod, setInvoicePeriod] = useState(currentPeriod.slice(0, 7));
    const [buildingId, setBuildingId] = useState("");
    const [serviceCode, setServiceCode] = useState("maintenance");
    const [description, setDescription] = useState("Содержание и ремонт общего имущества");
    const [unitPrice, setUnitPrice] = useState("");
    const [dueAt, setDueAt] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [apartmentId, setApartmentId] = useState("");
    const [importCompany, setImportCompany] = useState("");
    const [report, setReport] = useState<PaymentImportReport | null>(null);
    const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
    const apartmentsQuery = useApartments(buildingId ? Number(buildingId) : undefined, Boolean(buildingId));
    const createAccount = useCreateAccount();
    const generate = useGenerateAccrual();
    const importMutation = useImportPayments();
    const apartmentLabels = useMemo(() => {
        const buildingsById = new Map(buildings.map((item) => [item.id, `${item.city}, ${item.street}, ${item.house_number}${item.building_suffix}`]));
        const apartmentsById = new Map((apartmentsQuery.data ?? []).map((item) => [item.id, `${buildingsById.get(item.building_id) ?? `Дом ${item.building_id}`}, кв. ${item.number}`]));
        return apartmentsById;
    }, [apartmentsQuery.data, buildings]);

    if (scopes.isLoading) return <div>Проверка прав доступа…</div>;
    if (scopes.isError) return <div>Не удалось загрузить область доступа. Проверьте сессию и повторите запрос.</div>;
    if (!scopes.data?.is_platform_admin && !scopes.data?.scoped_roles.includes("company_admin")) return <div
        role="alert">Раздел доступен администраторам платформы и управляющей компании.</div>;

    const downloadExport = async () => {
        setMessage("");
        if (!buildingId || !invoicePeriod) {
            setMessage("Выберите дом и период для выгрузки.");
            return;
        }
        try {
            const file = await billingApi.exportAccruals(Number(buildingId), `${invoicePeriod}-01`);
            const url = URL.createObjectURL(file);
            const link = document.createElement("a");
            link.href = url;
            link.download = `billing-${buildingId}-${invoicePeriod}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            setMessage("Выгрузка начислений скачана.");
        } catch (error) {
            setMessage(errorText(error));
        }
    };

    const submitAccrual = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage("");
        if (!window.confirm(`Создать начисление «${description}» за ${invoicePeriod} для лицевых счетов выбранного дома? Повторное создание может быть пропущено сервером по уникальному ограничению.`)) return;
        try {
            const result = await generate.mutateAsync({
                building_id: Number(buildingId),
                billing_period: `${invoicePeriod}-01`,
                service_code: serviceCode,
                description,
                unit_price: unitPrice,
                due_at: new Date(`${dueAt}T23:59:59`).toISOString()
            });
            setMessage(`Начисления сформированы: создано ${result.created_count}, пропущено ${result.skipped_count}, сумма ${money(result.total_amount)}.`);
            setAccrualOpen(false);
        } catch (error) {
            setMessage(errorText(error));
        }
    };

    const submitAccount = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage("");
        try {
            await createAccount.mutateAsync({
                apartment_id: Number(apartmentId),
                account_number: accountNumber.trim(),
                source_system: "internal"
            });
            setMessage("Лицевой счёт создан.");
            setAccountOpen(false);
            setAccountNumber("");
            setApartmentId("");
        } catch (error) {
            setMessage(errorText(error));
        }
    };

    const submitImport = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage("");
        setReport(null);
        const data = new FormData(event.currentTarget);
        const file = data.get("registry");
        if (!(file instanceof File) || !file.size || !importCompany) {
            setMessage("Выберите CSV-файл и управляющую компанию.");
            return;
        }
        try {
            const result = await importMutation.mutateAsync({companyId: Number(importCompany), file});
            setReport(result);
            setMessage("Реестр обработан. Результат импорта приведён ниже.");
        } catch (error) {
            setMessage(errorText(error));
        }
    };

    return <section>
        <header>
            <div><p>Финансы</p><h1>Биллинг</h1><p>Лицевые счета, начисления, выгрузка и история оплат.</p></div>
            <div>
                <button onClick={() => {
                    setMessage("");
                    setAccountOpen((v) => !v);
                }}>Лицевой счёт
                </button>
                <button onClick={() => {
                    setMessage("");
                    setAccrualOpen((v) => !v);
                }}>Создать начисление
                </button>
            </div>
        </header>
        {message && <div role="status">{message}</div>}

        {accountOpen &&
            <form onSubmit={submitAccount}><h2>Новый лицевой счёт</h2><label>Дом<select required value={buildingId}
                                                                                        onChange={(e) => {
                                                                                            setBuildingId(e.target.value);
                                                                                            setApartmentId("");
                                                                                        }}>
                <option value="">Выберите дом</option>
                {buildings.map((b) => <option key={b.id}
                                              value={b.id}>{b.city}, {b.street}, {b.house_number}{b.building_suffix}</option>)}
            </select></label><label>Квартира<select required value={apartmentId}
                                                    onChange={(e) => setApartmentId(e.target.value)}>
                <option value="">Выберите квартиру</option>
                {(apartmentsQuery.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.number}</option>)}</select></label><label>Номер
                счёта<input required value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                            maxLength={80}/></label>
                <div>
                    <button
                        disabled={createAccount.isPending}>{createAccount.isPending ? "Создание…" : "Создать"}</button>
                    <button type="button" onClick={() => setAccountOpen(false)}>Отмена</button>
                </div>
            </form>}

        {accrualOpen &&
            <form onSubmit={submitAccrual}><h2>Генерация начислений</h2><label>Дом<select required value={buildingId}
                                                                                          onChange={(e) => setBuildingId(e.target.value)}>
                <option value="">Выберите дом</option>
                {buildings.map((b) => <option key={b.id}
                                              value={b.id}>{b.city}, {b.street}, {b.house_number}{b.building_suffix}</option>)}
            </select></label><label>Период<input required type="month" value={invoicePeriod}
                                                 onChange={(e) => setInvoicePeriod(e.target.value)}/></label><label>Срок
                оплаты<input required type="date" value={dueAt}
                             onChange={(e) => setDueAt(e.target.value)}/></label><label>Код услуги<input required
                                                                                                         value={serviceCode}
                                                                                                         onChange={(e) => setServiceCode(e.target.value)}
                                                                                                         maxLength={60}/></label><label>Описание<input
                required value={description} onChange={(e) => setDescription(e.target.value)}
                maxLength={250}/></label><label>Сумма на счёт, ₽<input required type="number" min="0.01" step="0.01"
                                                                       value={unitPrice}
                                                                       onChange={(e) => setUnitPrice(e.target.value)}/></label>
                <div>
                    <button
                        disabled={generate.isPending || !buildingId}>{generate.isPending ? "Обработка…" : "Проверить и создать"}</button>
                    <button type="button" onClick={() => setAccrualOpen(false)}>Отмена</button>
                </div>
            </form>}

        <section>
            <div>
                <div><h2>Начисления и счета</h2><p>Начисления и статусы по домам, доступным вашей учётной записи.</p></div>
                <div><input aria-label="Период" type="month" value={periodFilter}
                            onChange={(e) => setPeriodFilter(e.target.value)}/><select aria-label="Дом"
                                                                                       value={buildingFilter}
                                                                                       onChange={(e) => setBuildingFilter(e.target.value)}>
                    <option value="">Все дома</option>
                    {buildings.map((b) => <option key={b.id} value={b.id}>{b.street}, {b.house_number}</option>)}
                </select><select aria-label="Статус оплаты" value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="">Все статусы</option>
                    {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select></div>
            </div>
            {invoicesQuery.isLoading ? <p>Загрузка счетов…</p> : invoicesQuery.isError ?
                <p role="alert">{errorText(invoicesQuery.error)}</p> : !invoicesQuery.data?.length ?
                    <p>Счета не найдены по выбранным условиям.</p> : <div>
                        <table>
                            <thead>
                            <tr>
                                <th>Период / счёт</th>
                                <th>Лицевой счёт</th>
                                <th>Начислено</th>
                                <th>Оплачено</th>
                                <th>Долг</th>
                                <th>Статус</th>
                            </tr>
                            </thead>
                            <tbody>{invoicesQuery.data.map((invoice) => <tr key={invoice.id}>
                                <td><Link
                                    to={`/dashboard/billing/invoices/${invoice.id}`}>{invoice.billing_period.slice(0, 7)}</Link>
                                    <div>№{invoice.id}</div>
                                </td>
                                <td>{invoice.account_number}</td>
                                <td>{money(invoice.total_amount)}</td>
                                <td>{money(invoice.paid_amount)}</td>
                                <td>{money(invoice.balance)}</td>
                                <td>{statusLabel[invoice.status] ?? invoice.status}</td>
                            </tr>)}</tbody>
                        </table>
                    </div>}</section>

        <div>
            <section>
                <div>
                    <div><h2>Лицевые счета</h2><p>Показаны первые 100 счетов.</p></div>
                    <button onClick={() => accountsQuery.refetch()} aria-label="Обновить лицевые счета"></button>
                </div>
                {accountsQuery.isError ?
                    <p role="alert">{errorText(accountsQuery.error)}</p> : accountsQuery.isLoading ? <p>Загрузка…</p> :
                        <div>{(accountsQuery.data ?? []).map((account) => <div key={account.id}>
                            <span>{account.account_number}</span><span>{apartmentLabels.get(account.apartment_id) ?? `Квартира №${account.apartment_id}`}{!account.is_active && " · неактивен"}</span>
                        </div>)}{!accountsQuery.data?.length && <p>Лицевые счета не найдены.</p>}</div>}</section>
            <section><h2>Реестры обмена</h2><p>CSV формат</p>
                <div>
                    <div><select aria-label="Дом для выгрузки" value={buildingId}
                                 onChange={(e) => setBuildingId(e.target.value)}>
                        <option value="">Дом для выгрузки</option>
                        {buildings.map((b) => <option key={b.id} value={b.id}>{b.street}, {b.house_number}</option>)}
                    </select><input aria-label="Период выгрузки" type="month" value={invoicePeriod}
                                    onChange={(e) => setInvoicePeriod(e.target.value)}/>
                        <button onClick={downloadExport}>CSV</button>
                    </div>
                    <form onSubmit={submitImport}><label>Импорт подтверждений оплат</label>
                        <div><select required aria-label="Управляющая компания" value={importCompany}
                                     onChange={(e) => setImportCompany(e.target.value)}>
                            <option value="">УК</option>
                            {Array.from(new Set(buildings.map((b) => b.management_company_id))).map((id) => <option
                                key={id} value={id}>УК №{id}</option>)}</select><input required name="registry"
                                                                                       type="file"
                                                                                       accept=".csv,text/csv"/>
                            <button
                                disabled={importMutation.isPending}>{importMutation.isPending ? "Загрузка…" : "Импорт"}</button>
                        </div>
                    </form>
                    {report && <div><p>Импортировано: {report.imported_count} · Дубликатов: {report.duplicate_count} ·
                        Отклонено: {report.rejected_count}</p>{report.rejected_rows.length > 0 &&
                        <ul>{report.rejected_rows.map((row, index) => <li
                            key={`${row.row}-${index}`}>Строка {row.row}: {row.reason}</li>)}</ul>}</div>}</div>
            </section>
        </div>
    </section>;
}
