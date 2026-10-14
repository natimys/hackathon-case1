import {apiClient} from "@/lib/api";
import type {
    AccessScopes,
    Apartment,
    Building,
    Technician,
    Ticket,
    TicketAssignment,
    TicketAttachment,
    TicketFilters,
    TicketHistory,
    TicketPage
} from "@/modules/tickets/types";

export async function getTickets(filters: TicketFilters = {}) {
    const {data} = await apiClient.get<TicketPage>("/tickets", {params: filters});
    return data;
}

export async function getTicket(id: number) {
    return (await apiClient.get<Ticket>(`/tickets/${id}`)).data;
}

export async function createTicket(input: {
    apartment_id: number;
    title: string;
    description: string;
    priority: string
}) {
    return (await apiClient.post<Ticket>("/tickets", input)).data;
}

export async function getHistory(id: number) {
    return (await apiClient.get<TicketHistory[]>(`/tickets/${id}/history`)).data;
}

export async function getAssignments(id: number) {
    return (await apiClient.get<TicketAssignment[]>(`/tickets/${id}/assignments`)).data;
}

export async function getAttachments(id: number) {
    return (await apiClient.get<TicketAttachment[]>(`/tickets/${id}/attachments`)).data;
}

export async function getBuildings() {
    return (await apiClient.get<Building[]>("/properties/buildings")).data;
}

export async function getApartments(buildingId?: number) {
    return (await apiClient.get<Apartment[]>("/properties/apartments", {params: buildingId ? {building_id: buildingId} : {}})).data;
}

export async function getTechnicians(buildingId: number) {
    return (await apiClient.get<Technician[]>(`/access/buildings/${buildingId}/technicians`)).data;
}

export async function getAccessScopes() {
    return (await apiClient.get<AccessScopes>("/access/me/scopes")).data;
}

export async function transitionTicket(id: number, status: string, comment?: string) {
    return (await apiClient.post<Ticket>(`/tickets/${id}/transitions`, {
        status,
        comment: comment?.trim() || null
    })).data;
}

export async function assignTechnician(id: number, technician_id: number) {
    return (await apiClient.post<TicketAssignment>(`/tickets/${id}/assignments`, {technician_id})).data;
}

export async function rateTicket(id: number, rating: number) {
    return (await apiClient.post<Ticket>(`/tickets/${id}/rating`, {rating})).data;
}

export async function uploadAttachment(id: number, file: File) {
    const body = new FormData();
    body.append("file", file);
    return (await apiClient.post<TicketAttachment>(`/tickets/${id}/attachments`, body, {headers: {"Content-Type": undefined}})).data;
}

export async function downloadAttachment(id: number, attachmentId: number) {
    return (await apiClient.get<Blob>(`/tickets/${id}/attachments/${attachmentId}`, {responseType: "blob"})).data;
}
