import {apiClient} from "@/lib/api";
import type {AccrualResult, Invoice, Payment, PaymentImportReport, PersonalAccount} from "@/modules/billing/types";

export async function listAccounts() {
    return (await apiClient.get<PersonalAccount[]>("/billing/accounts", {params: {limit: 100, offset: 0}})).data;
}

export async function createAccount(input: { apartment_id: number; account_number: string; source_system: string }) {
    return (await apiClient.post<PersonalAccount>("/billing/accounts", input)).data;
}

export async function listInvoices(filters: { building_id?: number; period?: string; state?: string }) {
    return (await apiClient.get<Invoice[]>("/billing/invoices", {params: {limit: 100, offset: 0, ...filters}})).data;
}

export async function getInvoice(id: number) {
    return (await apiClient.get<Invoice>(`/billing/invoices/${id}`)).data;
}

export async function getPayments(invoiceId: number) {
    return (await apiClient.get<Payment[]>(`/billing/invoices/${invoiceId}/payments`)).data;
}

export async function generateAccrual(input: {
    building_id: number;
    billing_period: string;
    service_code: string;
    description: string;
    unit_price: string;
    due_at: string
}) {
    return (await apiClient.post<AccrualResult>("/billing/accruals/generate", input)).data;
}

export async function exportAccruals(buildingId: number, period: string) {
    return (await apiClient.get<Blob>("/billing/exports/accruals", {
        params: {building_id: buildingId, period},
        responseType: "blob"
    })).data;
}

export async function importPayments(companyId: number, file: File) {
    const body = new FormData();
    body.append("file", file);
    return (await apiClient.post<PaymentImportReport>("/billing/imports/payments", body, {
        params: {company_id: companyId},
        headers: {"Content-Type": undefined}
    })).data;
}
