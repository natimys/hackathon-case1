export type TicketStatus = "new" | "assigned" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface Ticket {
    id: number;
    building_id: number;
    apartment_id: number;
    created_by_id: number;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    closed_at: string | null;
    rating: number | null;
}

export interface TicketPage {
    items: Ticket[];
    total: number;
    limit: number;
    offset: number
}

export interface TicketHistory {
    id: number;
    ticket_id: number;
    previous_status: TicketStatus | null;
    new_status: TicketStatus;
    changed_by_id: number;
    comment: string | null;
    created_at: string
}

export interface TicketAssignment {
    id: number;
    ticket_id: number;
    technician_id: number;
    assigned_by_id: number;
    assigned_at: string;
    ended_at: string | null
}

export interface TicketAttachment {
    id: number;
    ticket_id: number;
    uploaded_by_id: number;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    created_at: string
}

export interface Building {
    id: number;
    management_company_id: number;
    city: string;
    street: string;
    house_number: string;
    building_suffix: string
}

export interface Apartment {
    id: number;
    building_id: number;
    entrance_id: number | null;
    number: string
}

export interface Technician {
    id: number;
    name: string
}

export interface AccessScopes {
    user_id: number;
    is_platform_admin: boolean;
    scoped_roles: ("company_admin" | "technician")[];
    is_resident: boolean
}

export interface TicketFilters {
    status?: TicketStatus;
    priority?: TicketPriority;
    building_id?: number;
    assigned_to?: number;
    limit?: number;
    offset?: number
}
