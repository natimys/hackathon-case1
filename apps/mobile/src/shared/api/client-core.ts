import { ApiError, describeApiError } from "./errors";
import type { MobileTokenPair } from "./contracts";

export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: MobileTokenPair): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  fetcher?: typeof fetch;
  onSessionExpired?: () => void;
  timeoutMs?: number;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  retryAfterRefresh?: boolean;
};

function responseDetail(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "detail" in payload) {
    return (payload as { detail: unknown }).detail;
  }
  return payload;
}

export class ApiClient {
  private readonly fetcher: typeof fetch;
  private refreshTask: Promise<boolean> | null = null;
  private readonly timeoutMs: number;

  constructor(private readonly options: ApiClientOptions) {
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  setOnSessionExpired(handler: () => void) {
    this.options.onSessionExpired = handler;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const accessToken = await this.options.tokenStore.getAccessToken();
    const response = await this.send(path, {
      method,
      body: options.body,
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      if (options.retryAfterRefresh !== false && await this.refresh()) {
        return this.request<T>(path, { ...options, retryAfterRefresh: false });
      }
      await this.expireSession();
    }

    return this.readResponse<T>(response);
  }

  async login(email: string, password: string): Promise<void> {
    const tokens = await this.sendJson<MobileTokenPair>("/auth/mobile/login", {
      method: "POST",
      body: { email, password },
    });
    await this.options.tokenStore.setTokens(tokens);
  }

  async logout(): Promise<void> {
    const refreshToken = await this.options.tokenStore.getRefreshToken();
    try {
      if (refreshToken) {
        await this.send("/auth/mobile/logout/", {
          method: "POST",
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
      }
    } finally {
      await this.options.tokenStore.clearTokens();
    }
  }

  private async refresh(): Promise<boolean> {
    if (this.refreshTask) return this.refreshTask;
    this.refreshTask = (async () => {
      const refreshToken = await this.options.tokenStore.getRefreshToken();
      if (!refreshToken) return false;
      try {
        const tokens = await this.sendJson<MobileTokenPair>("/auth/mobile/refresh", {
          method: "POST",
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
        await this.options.tokenStore.setTokens(tokens);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status !== 401) throw error;
        return false;
      }
    })();
    try {
      return await this.refreshTask;
    } finally {
      this.refreshTask = null;
    }
  }

  private async expireSession(): Promise<void> {
    await this.options.tokenStore.clearTokens();
    this.options.onSessionExpired?.();
  }

  private async sendJson<T>(path: string, options: RequestOptions): Promise<T> {
    return this.readResponse<T>(await this.send(path, options));
  }

  private async send(path: string, options: RequestOptions): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const hasBody = options.body !== undefined;
    const headers = { ...options.headers };
    let body: BodyInit | undefined;
    if (hasBody && options.body instanceof FormData) {
      body = options.body;
    } else if (hasBody) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    try {
      return await this.fetcher(`${this.options.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "Сервер не ответил за отведённое время. Проверьте подключение и повторите попытку."
        : "Нет связи с сервером. Проверьте интернет и адрес API.";
      throw new ApiError(message, null, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      const detail = responseDetail(payload);
      throw new ApiError(describeApiError(response.status, detail), response.status, detail);
    }
    return payload as T;
  }
}
