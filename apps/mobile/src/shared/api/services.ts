import { apiClient } from "./client";
import { secureTokenStore } from "./session";
import type {
  AccessScopes,
  Account,
  Apartment,
  Building,
  Invoice,
  Payment,
  Ticket,
  TicketAttachment,
  TicketCreate,
  TicketHistory,
  TicketPage,
  UserPublic,
} from "./contracts";

export const authApi = {
  login: (email: string, password: string) => apiClient.login(email, password),
  logout: () => apiClient.logout(),
  async me() {
    if (!(await secureTokenStore.getAccessToken())) return null;
    return apiClient.request<UserPublic>("/auth/me/");
  },
};

export const profileApi = {
  scopes: () => apiClient.request<AccessScopes>("/access/me/scopes"),
  buildings: () => apiClient.request<Building[]>("/properties/buildings"),
  apartments: (buildingId?: number) => {
    const query = buildingId ? `?building_id=${buildingId}` : "";
    return apiClient.request<Apartment[]>(`/properties/apartments${query}`);
  },
};

export const billingApi = {
  accounts: () => apiClient.request<Account[]>("/billing/accounts"),
  invoices: () => apiClient.request<Invoice[]>("/billing/invoices"),
  invoice: (id: number) => apiClient.request<Invoice>(`/billing/invoices/${id}`),
  payments: (id: number) => apiClient.request<Payment[]>(`/billing/invoices/${id}/payments`),
  createDemoPayment: (id: number, idempotencyKey: string) =>
    apiClient.request<Payment>(`/billing/invoices/${id}/demo-payments`, {
      method: "POST",
      body: { idempotency_key: idempotencyKey },
    }),
  confirmDemoPayment: (id: number) =>
    apiClient.request<Payment>(`/billing/payments/${id}/demo-confirm`, { method: "POST" }),
};

export const ticketsApi = {
  list: (offset = 0) => apiClient.request<TicketPage>(`/tickets?limit=100&offset=${offset}`),
  get: (id: number) => apiClient.request<Ticket>(`/tickets/${id}`),
  history: (id: number) => apiClient.request<TicketHistory[]>(`/tickets/${id}/history`),
  attachments: (id: number) => apiClient.request<TicketAttachment[]>(`/tickets/${id}/attachments`),
  create: (input: TicketCreate) => apiClient.request<Ticket>("/tickets", { method: "POST", body: input }),
  upload: (ticketId: number, file: { uri: string; name: string; mimeType: string }) => {
    const form = new FormData();
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    return apiClient.request<TicketAttachment>(`/tickets/${ticketId}/attachments`, {
      method: "POST",
      body: form,
    });
  },
};

export interface Camera {
  id: string;
  name: string;
  building_id: number;
  entrance_id: number | null;
  location_description: string;
  stream_path: string;
  source_type: string;
  enabled: boolean;
}

export interface CameraStatus { status: "online" | "offline" | "unknown" }
export interface MediaSession {
  camera_id: string;
  transport: "hls";
  url: string;
  token: string;
  expires_in: number;
}

export const camerasApi = {
  list: () => apiClient.request<Camera[]>("/cameras"),
  status: (id: string) => apiClient.request<CameraStatus>(`/cameras/${id}/status`),
  streamSession: (id: string) => apiClient.request<MediaSession>(`/cameras/${id}/stream-session`, { method: "POST" }),
};
