import axios, {type InternalAxiosRequestConfig} from "axios";

type AuthRetryConfig = InternalAxiosRequestConfig & {_authRetry?: boolean};

export const apiClient = axios.create({
    baseURL: "/api",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

let refreshRequest: Promise<void> | null = null;

function refreshSession(): Promise<void> {
    if (!refreshRequest) {
        refreshRequest = apiClient.post("/auth/refresh/").then(() => undefined).finally(() => {
            refreshRequest = null;
        });
    }
    return refreshRequest;
}

apiClient.interceptors.request.use((config) => {
    if (typeof document !== "undefined" && !["get", "head", "options"].includes((config.method || "get").toLowerCase())) {
        const needsRefreshCsrf = config.url?.includes("/refresh/") || config.url?.includes("/logout/");
        const csrfCookie = document.cookie.split("; ").find((cookie) =>
            cookie.startsWith(needsRefreshCsrf ? "csrf_refresh_token=" : "csrf_access_token="),
        );
        if (csrfCookie) {
            config.headers.set("X-CSRF-TOKEN", decodeURIComponent(csrfCookie.split("=").slice(1).join("=")));
        }
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const request = error.config as AuthRetryConfig | undefined;
        const isAuthEndpoint = ["/auth/login/", "/auth/refresh/", "/auth/logout/"].some((path) =>
            request?.url?.includes(path),
        );

        if (error.response?.status === 401 && request && !request._authRetry && !isAuthEndpoint) {
            request._authRetry = true;
            try {
                await refreshSession();
                return apiClient.request(request);
            } catch {
                // The refresh token is missing, expired, or has already been rotated.
            }
        }

        if (error.response?.status === 401 && typeof window !== "undefined") {
            const currentPath = window.location.pathname;
            if (currentPath !== "/login") {
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    },
);
