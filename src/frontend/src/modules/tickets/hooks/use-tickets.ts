import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import * as api from "@/modules/tickets/lib/api";
import type {TicketFilters} from "@/modules/tickets/types";

export const ticketsKey = ["tickets"] as const;

export function useTickets(filters: TicketFilters = {}) {
    return useQuery({queryKey: [...ticketsKey, filters], queryFn: () => api.getTickets(filters)});
}

export function useTicket(id: number) {
    return useQuery({
        queryKey: [...ticketsKey, id],
        queryFn: () => api.getTicket(id),
        enabled: Number.isFinite(id) && id > 0
    });
}

export function useTicketHistory(id: number) {
    return useQuery({queryKey: [...ticketsKey, id, "history"], queryFn: () => api.getHistory(id), enabled: id > 0});
}

export function useTicketAssignments(id: number) {
    return useQuery({
        queryKey: [...ticketsKey, id, "assignments"],
        queryFn: () => api.getAssignments(id),
        enabled: id > 0
    });
}

export function useTicketAttachments(id: number) {
    return useQuery({
        queryKey: [...ticketsKey, id, "attachments"],
        queryFn: () => api.getAttachments(id),
        enabled: id > 0
    });
}

export function useBuildings() {
    return useQuery({queryKey: ["properties", "buildings"], queryFn: api.getBuildings});
}

export function useApartments(buildingId?: number, enabled = buildingId !== undefined) {
    return useQuery({
        queryKey: ["properties", "apartments", buildingId],
        queryFn: () => api.getApartments(buildingId),
        enabled
    });
}

export function useAccessScopes() {
    return useQuery({queryKey: ["access", "my-scopes"], queryFn: api.getAccessScopes});
}

export function useTechnicians(buildingId?: number, enabled = true) {
    return useQuery({
        queryKey: ["access", "technicians", buildingId],
        queryFn: () => api.getTechnicians(buildingId as number),
        enabled: enabled && buildingId !== undefined
    });
}

function useInvalidateTicket(id?: number) {
    const client = useQueryClient();
    return () => {
        client.invalidateQueries({queryKey: ticketsKey});
        if (id) client.invalidateQueries({queryKey: [...ticketsKey, id]});
    };
}

export function useCreateTicket() {
    const invalidate = useInvalidateTicket();
    return useMutation({mutationFn: api.createTicket, onSuccess: invalidate});
}

export function useTransitionTicket(id: number) {
    const invalidate = useInvalidateTicket(id);
    return useMutation({
        mutationFn: ({status, comment}: {
            status: string;
            comment?: string
        }) => api.transitionTicket(id, status, comment), onSuccess: invalidate
    });
}

export function useAssignTechnician(id: number) {
    const invalidate = useInvalidateTicket(id);
    return useMutation({
        mutationFn: (technicianId: number) => api.assignTechnician(id, technicianId), onSuccess: () => {
            invalidate();
        },
    });
}

export function useRateTicket(id: number) {
    const invalidate = useInvalidateTicket(id);
    return useMutation({mutationFn: (rating: number) => api.rateTicket(id, rating), onSuccess: invalidate});
}

export function useUploadAttachment(id: number) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => api.uploadAttachment(id, file), onSuccess: () => {
            client.invalidateQueries({queryKey: [...ticketsKey, id, "attachments"]});
        }
    });
}
