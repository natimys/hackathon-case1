import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "@/shared/api/services";

export const billingKey = ["billing"] as const;

export function useAccounts() {
  return useQuery({ queryKey: [...billingKey, "accounts"], queryFn: billingApi.accounts });
}

export function useInvoices() {
  return useQuery({ queryKey: [...billingKey, "invoices"], queryFn: billingApi.invoices });
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: [...billingKey, "invoice", id],
    queryFn: () => billingApi.invoice(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function usePayments(id: number) {
  return useQuery({
    queryKey: [...billingKey, "invoice", id, "payments"],
    queryFn: () => billingApi.payments(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function usePayment(invoiceId: number) {
  const client = useQueryClient();
  const idempotencyKey = useRef(
    `mobile-${invoiceId}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
  );
  return useMutation({
    mutationFn: () => billingApi.createPayment(invoiceId, idempotencyKey.current),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: billingKey });
      client.invalidateQueries({ queryKey: [...billingKey, "invoice", invoiceId] });
      client.invalidateQueries({ queryKey: [...billingKey, "invoice", invoiceId, "payments"] });
    },
  });
}
