import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import * as api from "@/modules/billing/lib/api";

export const billingKey = ["billing"] as const;

export function useAccounts() {
    return useQuery({queryKey: [...billingKey, "accounts"], queryFn: api.listAccounts});
}

export function useInvoices(filters: { building_id?: number; period?: string; state?: string } = {}) {
    return useQuery({queryKey: [...billingKey, "invoices", filters], queryFn: () => api.listInvoices(filters)});
}

export function useInvoice(id: number) {
    return useQuery({
        queryKey: [...billingKey, "invoices", id],
        queryFn: () => api.getInvoice(id),
        enabled: Number.isInteger(id) && id > 0
    });
}

export function usePayments(invoiceId: number) {
    return useQuery({
        queryKey: [...billingKey, "invoices", invoiceId, "payments"],
        queryFn: () => api.getPayments(invoiceId),
        enabled: invoiceId > 0
    });
}

export function useCreateAccount() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: api.createAccount,
        onSuccess: () => client.invalidateQueries({queryKey: billingKey})
    });
}

export function useGenerateAccrual() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: api.generateAccrual,
        onSuccess: () => client.invalidateQueries({queryKey: billingKey})
    });
}

export function useImportPayments() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: ({companyId, file}: {
            companyId: number;
            file: File
        }) => api.importPayments(companyId, file), onSuccess: () => client.invalidateQueries({queryKey: billingKey})
    });
}
