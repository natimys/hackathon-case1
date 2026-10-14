export interface PersonalAccount {
    id: number;
    apartment_id: number;
    account_number: string;
    source_system: string;
    external_id: string | null;
    is_active: boolean;
    created_at: string;
}

export interface InvoiceItem {
    id: number;
    service_code: string;
    description: string;
    quantity: number;
    unit_price: string;
    amount: string;
}

export interface Invoice {
    id: number;
    personal_account_id: number;
    account_number: string;
    billing_period: string;
    issued_at: string;
    due_at: string;
    total_amount: string;
    paid_amount: string;
    balance: string;
    currency: string;
    status: "unpaid" | "partially_paid" | "paid" | "overdue";
    items: InvoiceItem[];
}

export interface Payment {
    id: number;
    invoice_id: number;
    provider: string;
    provider_reference: string | null;
    amount: string;
    currency: string;
    status: string;
    created_at: string;
    confirmed_at: string | null;
}

export interface AccrualResult {
    created_count: number;
    skipped_count: number;
    total_amount: string;
}

export interface PaymentImportReport {
    imported_count: number;
    duplicate_count: number;
    rejected_count: number;
    rejected_rows: { row: number; reason: string }[];
}
