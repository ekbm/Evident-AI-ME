import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { resetGlobalAuthFailed } from "@/lib/queryClient";

const AUTH_TOKEN_KEY = "evident_auth_token";
const LAST_ACTIVITY_KEY = "evident_last_activity";
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
  }
}

export function clearStoredAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
  }
}

function updateLastActivity(): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch {}
}

function getLastActivity(): number {
  try {
    const val = localStorage.getItem(LAST_ACTIVITY_KEY);
    return val ? parseInt(val, 10) : Date.now();
  } catch {
    return Date.now();
  }
}

function isInactivityExpired(): boolean {
  const lastActivity = getLastActivity();
  return Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS;
}

async function fetchUser(): Promise<User | null> {
  const headers: HeadersInit = {};

  const authToken = getStoredAuthToken();
  if (authToken) {
    headers["X-Auth-Token"] = authToken;
  }

  if (isInactivityExpired() && !authToken) {
    return null;
  }

  const wasInactive = isInactivityExpired() && !!authToken;

  const response = await fetch("/api/auth/user", {
    credentials: "include",
    headers,
  });

  if (response.status === 401) {
    if (authToken) {
      clearStoredAuthToken();
    }
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data && data.sessionExpired === true && !data.id) {
    if (authToken) {
      clearStoredAuthToken();
    }
    return null;
  }

  if (data && data.id) {
    updateLastActivity();
    if (wasInactive) {
      resetGlobalAuthFailed();
    }
  }

  return data;
}

async function logoutEmailAuth(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    clearStoredAuthToken();
    return response.ok;
  } catch (error) {
    console.error("Logout error:", error);
    clearStoredAuthToken();
    return false;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [sessionExpired, setSessionExpired] = useState(false);
  const wasAuthenticatedRef = useRef(false);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => updateLastActivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateLastActivity();
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient]);

  const { data: rawUser, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    refetchInterval: SESSION_CHECK_INTERVAL,
    refetchIntervalInBackground: false,
  });

  const isExpiredMarker = rawUser && (rawUser as any).__sessionExpired === true;
  const user = isExpiredMarker ? null : rawUser;

  useEffect(() => {
    if (user && user.id) {
      const wasUnauthenticated = !wasAuthenticatedRef.current;
      wasAuthenticatedRef.current = true;
      setSessionExpired(false);
      resetGlobalAuthFailed();
      if (wasUnauthenticated) {
        queryClient.invalidateQueries();
      }
    } else if (!isLoading && wasAuthenticatedRef.current && !isLoggingOutRef.current) {
      if (!user) {
        setSessionExpired(true);
        wasAuthenticatedRef.current = false;
      }
    }
  }, [user, isLoading, isExpiredMarker, queryClient]);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
    wasAuthenticatedRef.current = false;
    resetGlobalAuthFailed();
    queryClient.setQueryData(["/api/auth/user"], null);
    queryClient.removeQueries({
      predicate: (query) => {
        const key = query.queryKey[0] as string;
        return typeof key === 'string' && key.startsWith('/api/') && key !== '/api/auth/user';
      },
    });
  }, [queryClient]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      isLoggingOutRef.current = true;
      wasAuthenticatedRef.current = false;

      clearStoredAuthToken();

      await queryClient.cancelQueries();
      queryClient.setQueryData(["/api/auth/user"], null);

      if (user?.authProvider === "email") {
        await logoutEmailAuth();
        queryClient.clear();
        window.location.replace("/");
      } else {
        window.location.replace("/api/logout");
      }
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    sessionExpired,
    dismissSessionExpired,
  };
}
