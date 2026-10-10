import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, UNAUTHORIZED_EVENT } from "@/lib/api";
import type { UserRole } from "@shared/schema";
export interface AuthUser { id: string; email: string; name: string; role: UserRole }
interface AuthContextValue { user: AuthUser | null; isLoading: boolean; error: ApiError | null; retry: () => void; logout: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null);
function isSignedOut(err: unknown) { return err instanceof ApiError && err.status === 401; }
function useSessionValue(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true); setError(null);
    void api.get("/api/auth/csrf").then(() => api.get<AuthUser>("/api/auth/me"))
      .then(data => { if (!cancelled) setUser(data); })
      .catch(err => { if (cancelled) return; setUser(null); if (!isSignedOut(err)) setError(err instanceof ApiError ? err : new ApiError("เชื่อมต่อกับระบบไม่สำเร็จ", 0, "NETWORK_ERROR")); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => { window.addEventListener(UNAUTHORIZED_EVENT, retry); return () => window.removeEventListener(UNAUTHORIZED_EVENT, retry); }, [retry]);
  const logout = useCallback(async () => { try { await api.post("/api/auth/logout"); } catch { /* expired sessions are already logged out */ } setUser(null); setError(null); }, []);
  return { user, isLoading, error, retry, logout };
}
export function AuthProvider({ children }: { children: React.ReactNode }) { return <AuthContext.Provider value={useSessionValue()}>{children}</AuthContext.Provider>; }
export function useAuth(): AuthContextValue { const ctx = useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx; }
