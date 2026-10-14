import {Link} from "react-router-dom";
import {useMemo, useState} from "react";
import {DataTable, Dialog, EmptyState, FilterBar, PageHeader, SectionCard, StatusBadge} from "@/components/ui";
import {useApartments, useBuildings} from "@/modules/tickets/hooks/use-tickets";
import {useAccounts, useCreateAccount, useGenerateAccrual, useImportPayments, useInvoices} from "@/modules/billing/hooks/use-billing";
import * as billingApi from "@/modules/billing/lib/api";
import type {PaymentImportReport} from "@/modules/billing/types";

const monthLabel = (period: string) => {
    const [year, month] = period.slice(0, 7).split("-").map(Number);
    const label = new Intl.DateTimeFormat("ru-RU", {month: "long", year: "numeric"}).format(new Date(year, month - 1, 1));
    return label.charAt(0).toLocaleUpperCase("ru-RU") + label.slice(1);
};
const money = (value: string) => new Intl.NumberFormat("ru-RU", {style: "currency", currency: "RUB"}).format(Number(value));
const currentPeriod = new Date().toISOString().slice(0, 7);
const statusLabel: Record<string, string> = {unpaid: "Не оплачен", partially_paid: "Частично оплачен", paid: "Оплачен", overdue: "Просрочен"};
const statusTone: Record<string, "neutral" | "success" | "warning" | "danger"> = {unpaid: "warning", partially_paid: "warning", paid: "success", overdue: "danger"};
function errorText(error: unknown) {
    const status = (error as {response?: {status?: number}})?.response?.status;
    if (status === 401) return "Сессия завершена. Войдите снова.";
    if (status === 403) return "У вас нет прав на это действие.";
    if (status === 409) return "Конфликт данных. Возможно, начисление за этот период уже создано.";
    if (status === 422) return "Проверьте введённые данные и формат файла.";
    if (status === 503) return "Импорт реестра временно недоступен.";
    return "Не удалось выполнить запрос. Повторите попытку.";
}

export default function BillingPage() {
    const buildingsQuery = useBuildings();
    const accountsQuery = useAccounts();
    const apartmentsQuery = useApartments(undefined, true);
    const [tab, setTab] = useState<"accruals" | "exchange">("accruals");
    const [state, setState] = useState("");
    const [periodFilter, setPeriodFilter] = useState("");
    const [buildingFilter, setBuildingFilter] = useState("");
    const invoicesQuery = useInvoices({...(state ? {state} : {}), ...(periodFilter ? {period: `${periodFilter}-01`} : {}), ...(buildingFilter ? {building_id: Number(buildingFilter)} : {})});
    const [message, setMessage] = useState("");
    const [dialog, setDialog] = useState<"account" | "accrual" | null>(null);
    const [invoicePeriod, setInvoicePeriod] = useState(currentPeriod);
    const [buildingId, setBuildingId] = useState("");
    const [exportBuildingId, setExportBuildingId] = useState("");
    const [serviceCode, setServiceCode] = useState("maintenance");
    const [description, setDescription] = useState("Содержание и ремонт общего имущества");
    const [unitPrice, setUnitPrice] = useState("");
    const [dueAt, setDueAt] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [apartmentId, setApartmentId] = useState("");
    const [exportPeriod, setExportPeriod] = useState(currentPeriod);
    const [importCompany, setImportCompany] = useState("");
    const [report, setReport] = useState<PaymentImportReport | null>(null);
    const buildings = useMemo(() => buildingsQuery.data ?? [], [buildingsQuery.data]);
    const apartments = apartmentsQuery.data ?? [];
    const apartmentsForBuilding = apartments.filter((apartment) => !buildingId || apartment.building_id === Number(buildingId));
    const buildingLabels = new Map(buildings.map((item) => [item.id, `${item.city}, ${item.street}, ${item.house_number}${item.building_suffix ? ` ${item.building_suffix}` : ""}`]));
    const apartmentsById = new Map(apartments.map((apartment) => [apartment.id, apartment]));
    const createAccount = useCreateAccount();
    const generate = useGenerateAccrual();
    const importMutation = useImportPayments();
    const closeDialog = () => setDialog(null);

    const downloadExport = async () => {
        setMessage("");
        if (!exportBuildingId || !exportPeriod) { setMessage("Выберите дом и период для выгрузки."); return; }
        try {
            const file = await billingApi.exportAccruals(Number(exportBuildingId), `${exportPeriod}-01`);
            const url = URL.createObjectURL(file);
            const link = document.createElement("a");
            link.href = url;
            link.download = `billing-${exportBuildingId}-${exportPeriod}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            setMessage("Выгрузка начислений скачана.");
        } catch (error) { setMessage(errorText(error)); }
    };

    const submitAccrual = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!window.confirm(`Создать начисление «${description}» за ${monthLabel(invoicePeriod)} для счетов выбранного дома?`)) return;
        setMessage("");
        try {
            const result = await generate.mutateAsync({building_id: Number(buildingId), billing_period: `${invoicePeriod}-01`, service_code: serviceCode, description, unit_price: unitPrice, due_at: new Date(`${dueAt}T23:59:59`).toISOString()});
            setMessage(`Начисления сформированы: создано ${result.created_count}, пропущено ${result.skipped_count}, сумма ${money(result.total_amount)}.`);
            closeDialog();
        } catch (error) { setMessage(errorText(error)); }
    };

    const submitAccount = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage("");
        try {
            await createAccount.mutateAsync({apartment_id: Number(apartmentId), account_number: accountNumber.trim(), source_system: "internal"});
            setMessage("Лицевой счёт создан.");
            closeDialog();
            setAccountNumber("");
            setApartmentId("");
        } catch (error) { setMessage(errorText(error)); }
    };

    const submitImport = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage("");
        setReport(null);
        const form = event.currentTarget;
        const file = new FormData(form).get("registry");
        if (!(file instanceof File) || !file.size || !importCompany) { setMessage("Выберите CSV-файл и управляющую компанию."); return; }
        if (!window.confirm(`Загрузить файл «${file.name}» и обработать реестр платежей?`)) return;
        try {
            const result = await importMutation.mutateAsync({companyId: Number(importCompany), file});
            setReport(result);
            setMessage("Реестр обработан. Результат импорта приведён ниже.");
            form.reset();
        } catch (error) { setMessage(errorText(error)); }
    };

    const actions = <>
        <button type="button" onClick={() => {setMessage(""); setBuildingId(""); setDialog("account");}}>Добавить лицевой счёт</button>
        <button type="button" className="button-primary" onClick={() => {setMessage(""); setBuildingId(""); setDialog("accrual");}}>Создать начисление</button>
    </>;
    return <div className="billing-page">
        <PageHeader eyebrow="Финансы" title="Счета и начисления" description="Лицевые счета, начисления, выгрузка и сверка платежей." actions={actions}/>
        {message && <p className="billing-message" role="status">{message}</p>}
        <div className="section-tabs" role="tablist" aria-label="Разделы биллинга">
            <button type="button" role="tab" aria-selected={tab === "accruals"} className={tab === "accruals" ? "is-active" : ""} onClick={() => setTab("accruals")}>Начисления</button>
            <button type="button" role="tab" aria-selected={tab === "exchange"} className={tab === "exchange" ? "is-active" : ""} onClick={() => setTab("exchange")}>Обмен данными</button>
        </div>

        {tab === "accruals" ? <div className="billing-stack">
            <SectionCard title="Начисления" description="Начисления и статусы по домам, доступным вашей учётной записи.">
                <FilterBar className="billing-filters">
                    <label>Период<input type="month" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}/></label>
                    <label>Дом<select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="">Все дома</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.street}, {building.house_number}{building.building_suffix ? ` ${building.building_suffix}` : ""}</option>)}</select></label>
                    <label>Статус<select value={state} onChange={(event) => setState(event.target.value)}><option value="">Все статусы</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                </FilterBar>
                {invoicesQuery.isLoading ? <EmptyState>Загружаем начисления…</EmptyState> : invoicesQuery.isError ? <p role="alert">{errorText(invoicesQuery.error)}</p> : !invoicesQuery.data?.length ? <EmptyState>Начисления не найдены по выбранным условиям.</EmptyState> :
                    <DataTable label="Таблица начислений"><thead><tr><th>Период</th><th>Лицевой счёт</th><th>Начислено</th><th>Оплачено</th><th>Остаток</th><th>Статус</th></tr></thead><tbody>{invoicesQuery.data.map((invoice) => <tr key={invoice.id}>
                        <td><Link to={`/dashboard/billing/invoices/${invoice.id}`}>{monthLabel(invoice.billing_period)}</Link><small className="table-secondary">Начисление №{invoice.id}</small></td>
                        <td>{invoice.account_number}</td><td className="amount-cell">{money(invoice.total_amount)}</td><td className="amount-cell">{money(invoice.paid_amount)}</td><td className="amount-cell">{money(invoice.balance)}</td>
                        <td><StatusBadge tone={statusTone[invoice.status] ?? "neutral"}>{statusLabel[invoice.status] ?? invoice.status}</StatusBadge></td>
                    </tr>)}</tbody></DataTable>}
            </SectionCard>
            <SectionCard title="Лицевые счета" description="Первые 100 счетов в пределах доступных полномочий." actions={<button type="button" className="icon-refresh" aria-label="Обновить лицевые счета" title="Обновить лицевые счета" onClick={() => void accountsQuery.refetch()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3"/></svg></button>}>
                {accountsQuery.isLoading ? <EmptyState>Загружаем лицевые счета…</EmptyState> : accountsQuery.isError ? <p role="alert">{errorText(accountsQuery.error)}</p> : !accountsQuery.data?.length ? <EmptyState>Лицевые счета не найдены.</EmptyState> : <ul className="account-list">{accountsQuery.data.map((account) => {
                    const apartment = apartmentsById.get(account.apartment_id);
                    const address = apartment ? `${buildingLabels.get(apartment.building_id) ?? `Дом ${apartment.building_id}`}, кв. ${apartment.number}` : `Квартира №${account.apartment_id}`;
                    return <li key={account.id}><div><Link to={`/dashboard/billing/accounts/${account.id}`} className="account-number-link">№ {account.account_number}</Link><span>{address}</span></div><StatusBadge tone={account.is_active ? "success" : "neutral"}>{account.is_active ? "Активен" : "Неактивен"}</StatusBadge></li>;
                })}</ul>}
            </SectionCard>
        </div> : <div className="billing-stack exchange-grid">
            <SectionCard title="Экспорт начислений" description="Скачайте реестр начислений в формате CSV.">
                <div className="exchange-form"><label>Дом<select value={exportBuildingId} onChange={(event) => setExportBuildingId(event.target.value)}><option value="">Выберите дом</option>{buildings.map((building) => <option key={building.id} value={building.id}>{buildingLabels.get(building.id)}</option>)}</select></label><label>Период<input type="month" value={exportPeriod} onChange={(event) => setExportPeriod(event.target.value)}/></label><button type="button" className="button-primary" disabled={!exportBuildingId} onClick={downloadExport}>Скачать CSV</button></div>
            </SectionCard>
            <SectionCard title="Импорт платежей" description="Загрузите CSV-реестр управляющей компании для сверки оплат.">
                <form className="exchange-form" onSubmit={submitImport}><label>Управляющая компания<select required value={importCompany} onChange={(event) => setImportCompany(event.target.value)}><option value="">Выберите компанию</option>{Array.from(new Set(buildings.map((building) => building.management_company_id))).map((id) => <option key={id} value={id}>УК №{id}</option>)}</select></label><label>CSV-файл<input required name="registry" type="file" accept=".csv,text/csv"/></label><button className="button-primary" disabled={importMutation.isPending}>{importMutation.isPending ? "Загружаем…" : "Загрузить"}</button></form>
                {report && <div className="import-report" role="status"><p>Импортировано: {report.imported_count} · Дубликатов: {report.duplicate_count} · Отклонено: {report.rejected_count}</p>{report.rejected_rows.length > 0 && <ul>{report.rejected_rows.map((row, index) => <li key={`${row.row}-${index}`}>Строка {row.row}: {row.reason}</li>)}</ul>}</div>}
            </SectionCard>
        </div>}

        {dialog === "account" && <Dialog title="Добавить лицевой счёт" onClose={closeDialog}>
            <form className="dialog-form" onSubmit={submitAccount}><label>Дом<select required value={buildingId} onChange={(event) => {setBuildingId(event.target.value); setApartmentId("");}}><option value="">Выберите дом</option>{buildings.map((building) => <option key={building.id} value={building.id}>{buildingLabels.get(building.id)}</option>)}</select></label><label>Квартира<select required value={apartmentId} onChange={(event) => setApartmentId(event.target.value)}><option value="">Выберите квартиру</option>{apartmentsForBuilding.map((apartment) => <option key={apartment.id} value={apartment.id}>{apartment.number}</option>)}</select></label><label>Номер лицевого счёта<input required value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} maxLength={80}/></label><div className="dialog-actions"><button type="button" onClick={closeDialog}>Отмена</button><button className="button-primary" disabled={createAccount.isPending}>{createAccount.isPending ? "Создание…" : "Создать счёт"}</button></div></form>
        </Dialog>}
        {dialog === "accrual" && <Dialog title="Создать начисление" onClose={closeDialog}>
            <form className="dialog-form" onSubmit={submitAccrual}><label>Дом<select required value={buildingId} onChange={(event) => setBuildingId(event.target.value)}><option value="">Выберите дом</option>{buildings.map((building) => <option key={building.id} value={building.id}>{buildingLabels.get(building.id)}</option>)}</select></label><label>Период<input required type="month" value={invoicePeriod} onChange={(event) => setInvoicePeriod(event.target.value)}/></label><label>Срок оплаты<input required type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></label><label>Код услуги<input required value={serviceCode} onChange={(event) => setServiceCode(event.target.value)} maxLength={60}/></label><label>Описание<input required value={description} onChange={(event) => setDescription(event.target.value)} maxLength={250}/></label><label>Сумма на счёт, ₽<input required type="number" min="0.01" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)}/></label><div className="dialog-actions"><button type="button" onClick={closeDialog}>Отмена</button><button className="button-primary" disabled={generate.isPending || !buildingId}>{generate.isPending ? "Обработка…" : "Проверить и создать"}</button></div></form>
        </Dialog>}
    </div>;
}
