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
  plans: () => apiClient.request<SubscriptionPlan[]>("/billing/plans"),
  subscription: () => apiClient.request<Subscription | null>("/billing/subscriptions/me"),
  subscribe: (planId: number, idempotencyKey: string) => apiClient.request<{ subscription_id: number; payment_id: number; status: string; confirmation_url: string | null }>(`/billing/plans/${planId}/subscribe`, { method: "POST", body: { idempotency_key: idempotencyKey } }),
  updateSubscriptionNotifications: (body: { notifications_enabled?: boolean; motion_start?: string | null; motion_end?: string | null; event_zones?: string[] }) => apiClient.request<{ notifications_enabled: boolean; event_preferences: Record<string, unknown> }>("/billing/subscriptions/me/preferences", { method: "PATCH", body }),
  cancelSubscription: () => apiClient.request<{ status: string; paid_until: string | null }>("/billing/subscriptions/me/cancel", { method: "POST" }),
  createPayment: (id: number, idempotencyKey: string) =>
    apiClient.request<Payment>(`/billing/invoices/${id}/payments`, {
      method: "POST",
      body: { idempotency_key: idempotencyKey },
    }),
};

export interface SubscriptionPlan { id: number; code: string; name: string; description: string; price: string; currency: string; duration_days: number; features: Record<string, boolean> }
export interface Subscription { id: number; plan: string; status: string; starts_at: string | null; ends_at: string | null; price: string; features: Record<string, boolean>; notifications_enabled: boolean; event_preferences: Record<string, unknown> }

export const notificationsApi = {
  preferences: () => apiClient.request<NotificationPreferences>("/notifications/preferences"),
  savePreferences: (body: NotificationPreferences) => apiClient.request<NotificationPreferences>("/notifications/preferences", { method: "PATCH", body }),
  registerDevice: (token: string) => apiClient.request<void>("/notifications/devices", { method: "POST", body: { token } }),
  unregisterDevice: (token: string) => apiClient.request<void>("/notifications/devices", { method: "DELETE", body: { token } }),
};
export interface NotificationPreferences { timezone: string; quiet_start: string | null; quiet_end: string | null; camera_offline_enabled: boolean; ticket_status_enabled: boolean }

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
