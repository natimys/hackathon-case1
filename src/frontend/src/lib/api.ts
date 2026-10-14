import axios from "axios";

export const apiClient = axios.create({
    baseURL: "/api",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

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
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== "undefined") {
                const currentPath = window.location.pathname;
                if (currentPath !== "/login") {
                    window.location.href = "/login";
                }
            }
        }
        return Promise.reject(error);
    },
);
