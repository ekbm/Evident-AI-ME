import { QueryClient, QueryFunction } from "@tanstack/react-query";

const AUTH_TOKEN_KEY = "evident_auth_token";

const DEFAULT_TIMEOUT_MS = 30000;
const CHAT_TIMEOUT_MS = 120000;

let globalAuthFailCount = 0;
let globalAuthDisabled = false;
const AUTH_FAIL_THRESHOLD = 3;
const AUTH_FAIL_COOLDOWN_MS = 60000;
let authCooldownTimer: ReturnType<typeof setTimeout> | null = null;
export function getGlobalAuthFailed(): boolean {
  return globalAuthDisabled;
}

export function resetGlobalAuthFailed(): void {
  globalAuthFailCount = 0;
  globalAuthDisabled = false;
  if (authCooldownTimer) {
    clearTimeout(authCooldownTimer);
    authCooldownTimer = null;
  }
}

function handleGlobalAuthFailure(): void {
  globalAuthFailCount++;
  if (globalAuthFailCount >= AUTH_FAIL_THRESHOLD && !globalAuthDisabled) {
    globalAuthDisabled = true;
    queryClient.cancelQueries();

    if (authCooldownTimer) clearTimeout(authCooldownTimer);
    authCooldownTimer = setTimeout(() => {
      globalAuthDisabled = false;
      globalAuthFailCount = 0;
      authCooldownTimer = null;
    }, AUTH_FAIL_COOLDOWN_MS);
  }
}

function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function getAuthHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...additionalHeaders };
  const authToken = getStoredAuthToken();
  if (authToken) {
    headers["X-Auth-Token"] = authToken;
  }
  return headers;
}

function getTimeoutForUrl(url: string): number {
  if (url.includes("/api/chat")) return CHAT_TIMEOUT_MS;
  if (url.includes("/api/quiz") || url.includes("/api/ingest")) return 90000;
  return DEFAULT_TIMEOUT_MS;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs?: number): Promise<Response> {
  const timeout = timeoutMs ?? getTimeoutForUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeout / 1000)}s. Please try again.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      const url = res.url || "";
      if (!url.includes("/api/auth/user")) {
        handleGlobalAuthFailure();
      }

      let body: any = null;
      try {
        body = await res.clone().json();
      } catch {}

      if (body?.sessionExpired) {
        queryClient.setQueryData(["/api/auth/user"], null);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        throw new Error("Your session has expired. Please sign in again.");
      }
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = getAuthHeaders(data ? { "Content-Type": "application/json" } : undefined);
  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = getAuthHeaders();
    const url = queryKey.join("/") as string;
    const res = await fetchWithTimeout(url, {
      credentials: "include",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
