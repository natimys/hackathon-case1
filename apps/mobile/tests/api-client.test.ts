import assert from "node:assert/strict";
import test from "node:test";
import { ApiClient, type TokenStore } from "../src/shared/api/client-core";
import type { MobileTokenPair } from "../src/shared/api/contracts";
import { ApiError } from "../src/shared/api/errors";

class MemoryTokens implements TokenStore {
  access: string | null = null;
  refresh: string | null = null;
  async getAccessToken() { return this.access; }
  async getRefreshToken() { return this.refresh; }
  async setTokens(tokens: MobileTokenPair) { this.access = tokens.access_token; this.refresh = tokens.refresh_token; }
  async clearTokens() { this.access = null; this.refresh = null; }
}

const pair = (access_token: string, refresh_token: string): MobileTokenPair => ({
  access_token,
  refresh_token,
  token_type: "bearer",
});

test("login stores backend-issued JWTs and authorized reads use bearer access tokens", async () => {
  const tokens = new MemoryTokens();
  const headers: Headers[] = [];
  const client = new ApiClient({
    baseUrl: "http://api.test",
    tokenStore: tokens,
    fetcher: async (_url, init) => {
      headers.push(new Headers(init?.headers));
      return new Response(JSON.stringify(pair("a1", "r1")), { status: 200 });
    },
  });
  await client.login("resident@example.com", "secret");
  assert.equal(tokens.access, "a1");
  await client.request("/auth/me/");
  assert.equal(headers.at(-1)?.get("authorization"), "Bearer a1");
});

test("expired access token refreshes once and retries the original request", async () => {
  const tokens = new MemoryTokens();
  await tokens.setTokens(pair("expired", "refresh-1"));
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const client = new ApiClient({
    baseUrl: "http://api.test",
    tokenStore: tokens,
    fetcher: async (input, init) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get("authorization");
      requests.push({ url, authorization });
      if (url.endsWith("/auth/mobile/refresh")) return new Response(JSON.stringify(pair("fresh", "refresh-2")), { status: 200 });
      if (authorization === "Bearer expired") return new Response(JSON.stringify({ detail: "expired" }), { status: 401 });
      return new Response(JSON.stringify({ name: "Resident", email: "r@example.com" }), { status: 200 });
    },
  });

  const result = await client.request<{ name: string }>("/auth/me/");
  assert.equal(result.name, "Resident");
  assert.equal(tokens.access, "fresh");
  assert.deepEqual(requests.map((request) => request.authorization), [
    "Bearer expired",
    "Bearer refresh-1",
    "Bearer fresh",
  ]);
});

test("failed refresh clears credentials and notifies the session guard", async () => {
  const tokens = new MemoryTokens();
  await tokens.setTokens(pair("expired", "invalid-refresh"));
  let expired = false;
  const client = new ApiClient({
    baseUrl: "http://api.test",
    tokenStore: tokens,
    onSessionExpired: () => { expired = true; },
    fetcher: async () => new Response(JSON.stringify({ detail: "invalid" }), { status: 401 }),
  });

  await assert.rejects(client.request("/billing/invoices"), (error: unknown) => error instanceof ApiError && error.status === 401);
  assert.equal(tokens.access, null);
  assert.equal(tokens.refresh, null);
  assert.equal(expired, true);
});

test("API errors retain status and validation details; failed operations are never success", async () => {
  const client = new ApiClient({
    baseUrl: "http://api.test",
    tokenStore: new MemoryTokens(),
    fetcher: async () => new Response(JSON.stringify({ detail: [{ loc: ["body", "title"], msg: "String should have at least 3 characters" }] }), { status: 422 }),
  });
  await assert.rejects(client.request("/tickets", { method: "POST", body: { title: "x" } }), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 422);
    assert.match(error.message, /at least 3 characters/);
    return true;
  });
});

test("server errors do not turn into successful responses", async () => {
  const client = new ApiClient({
    baseUrl: "http://api.test",
    tokenStore: new MemoryTokens(),
    fetcher: async () => new Response(JSON.stringify({ detail: "Internal server error" }), { status: 500 }),
  });
  await assert.rejects(client.request("/tickets", { method: "POST", body: {} }), (error: unknown) => error instanceof ApiError && error.status === 500);
});
