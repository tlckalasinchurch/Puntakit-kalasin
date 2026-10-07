import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { api, ApiError, UNAUTHORIZED_EVENT } from "@/lib/api";
import type { UserRole } from "@shared/schema";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /**
   * Why the signed-in identity could not be turned into a local profile.
   *
   * This used to not exist. `AuthContext` caught every failure from
   * `/api/auth/me` and set `user` to `null`, which is indistinguishable from
   * "not signed in": `ProtectedRoute` then redirected to `/login`, Clerk saw a
   * still-valid session and pushed the user back to `/`, and the two fought
   * each other in a redirect loop that users described as "ล็อกอินแล้วเด้งออก".
   * A 401 genuinely means signed out. A 403, a 5xx, or a dead connection mean
   * the account is real and the *app* is broken — so they surface here instead.
   */
  error: ApiError | null;
  /** Re-run the profile sync. Safe to call from the error screen's retry. */
  retry: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** True only for a genuine "you are not signed in" answer from the API. */
function isSignedOut(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/**
 * An expired session surfaces as a 401 on whatever request the user made
 * next. Re-run the profile sync: it answers 401 too, which clears the user and
 * lets `ProtectedRoute` send them to /login instead of showing "connection
 * failed" on every page.
 */
function useResyncOnUnauthorized(retry: () => void) {
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, retry);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, retry);
  }, [retry]);
}

/**
 * Clerk is the only identity provider. Clerk owns the browser session and the
 * API maps that identity to the local users table for roles and account state.
 */
function useClerkAuthValue(): AuthContextValue {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  /** Bumped by `retry()` to re-trigger the sync effect. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !userId) {
      setUser(null);
      setError(null);
      setSynced(true);
      return;
    }

    let cancelled = false;
    setError(null);
    setSynced(false);
    api
      .get<AuthUser>("/api/auth/me")
      .then(data => {
        if (!cancelled) setUser(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Only a 401 is "signed out". Everything else is a real failure that
        // must reach the user instead of being read as a logout.
        if (isSignedOut(err)) {
          setUser(null);
          setError(null);
        } else {
          setUser(null);
          setError(
            err instanceof ApiError
              ? err
              : new ApiError("เชื่อมต่อกับระบบไม่สำเร็จ", 0, "NETWORK_ERROR")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSynced(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useResyncOnUnauthorized(retry);

  const logout = useCallback(async () => {
    await clerk.signOut({ redirectUrl: "/login" }).catch(() => undefined);
    setUser(null);
    setError(null);
    setSynced(false);
  }, [clerk]);

  return {
    user,
    isLoading: !isLoaded || (Boolean(isSignedIn) && !synced),
    error,
    retry,
    logout,
  };
}

function useDemoAuthValue(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api
      .get<AuthUser>("/api/auth/me")
      .then(data => {
        if (!cancelled) setUser(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (!isSignedOut(err)) {
          setError(
            err instanceof ApiError
              ? err
              : new ApiError("เชื่อมต่อกับระบบไม่สำเร็จ", 0, "NETWORK_ERROR")
          );
        }
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useResyncOnUnauthorized(retry);

  return {
    user,
    isLoading,
    error,
    retry,
    logout: async () => setUser(null),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isDemoMode = import.meta.env.VITE_PUNTAKIT_DEMO_MODE === "1";
  if (isDemoMode) {
    return <AuthContext.Provider value={useDemoAuthValue()}>{children}</AuthContext.Provider>;
  }
  return (
    <AuthContext.Provider value={useClerkAuthValue()}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
