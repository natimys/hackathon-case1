import { ApiClient } from "./client-core";
import { secureTokenStore } from "./session";

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:8000";
const baseUrl = configuredBaseUrl.replace(/\/+$/, "");

if (!/^https?:\/\//i.test(baseUrl)) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL must be an absolute HTTP(S) URL");
}

export const apiClient = new ApiClient({ baseUrl, tokenStore: secureTokenStore });

export function setSessionExpiredHandler(handler: () => void) {
  apiClient.setOnSessionExpired(handler);
}
