import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketsApi } from "@/shared/api/services";

export const ticketsKey = ["tickets"] as const;

export function useTickets() {
  return useInfiniteQuery({
    queryKey: ticketsKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const page = await ticketsApi.list(pageParam);
      if (!page || !Array.isArray(page.items) || !Number.isFinite(page.limit) || page.limit <= 0) {
        throw new Error("Сервер вернул список заявок в неожиданном формате. Проверьте адрес API.");
      }
      return page;
    },
    getNextPageParam: (lastPage, pages) => {
      if (!Array.isArray(lastPage?.items) || !Number.isFinite(lastPage.limit) || lastPage.limit <= 0) {
        return undefined;
      }
      return lastPage.items.length === lastPage.limit ? pages.length * lastPage.limit : undefined;
    },
  });
}

export function useTicket(id: number) {
  return useQuery({ queryKey: [...ticketsKey, id], queryFn: () => ticketsApi.get(id), enabled: id > 0 });
}

export function useTicketHistory(id: number) {
  return useQuery({ queryKey: [...ticketsKey, id, "history"], queryFn: () => ticketsApi.history(id), enabled: id > 0 });
}

export function useTicketAttachments(id: number) {
  return useQuery({ queryKey: [...ticketsKey, id, "attachments"], queryFn: () => ticketsApi.attachments(id), enabled: id > 0 });
}

export function useCreateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ticketsApi.create,
    onSuccess: () => client.invalidateQueries({ queryKey: ticketsKey }),
  });
}

export function useUploadAttachment(ticketId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ticketsApi.upload.bind(null, ticketId),
    onSuccess: () => client.invalidateQueries({ queryKey: [...ticketsKey, ticketId, "attachments"] }),
  });
}
