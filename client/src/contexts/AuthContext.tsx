import { createContext, useContext, useEffect, useState } from "react";
import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { api } from "@/lib/api";
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Clerk is the only identity provider. Clerk owns the browser session and the
 * API maps that identity to the local users table for roles and account state.
 */
function useClerkAuthValue(): AuthContextValue {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !userId) {
      setUser(null);
      setSynced(true);
      return;
    }

    let cancelled = false;
    api
      .get<AuthUser>("/api/auth/me")
      .then(data => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setSynced(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  const logout = async () => {
    await clerk.signOut({ redirectUrl: "/login" }).catch(() => undefined);
    setUser(null);
    setSynced(false);
  };

  return {
    user,
    isLoading: !isLoaded || (Boolean(isSignedIn) && !synced),
    logout,
  };
}

function useDemoAuthValue(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<AuthUser>("/api/auth/me")
      .then(data => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading, logout: async () => setUser(null) };
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
