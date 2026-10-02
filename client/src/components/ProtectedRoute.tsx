import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/DesignSystem";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error, retry, logout } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // Redirect ONLY on a genuine signed-out state.
    //
    // The `!error` guard is the fix for "ล็อกอินแล้วเด้งออก": this used to be
    // `if (!isLoading && !user)`, so a 403/5xx from /api/auth/me — where Clerk
    // still had a perfectly valid session — sent the user to /login, and
    // Clerk's `fallbackRedirectUrl="/"` sent them straight back. Infinite loop,
    // no explanation. A failed profile load now renders an error instead.
    if (!isLoading && !user && !error) {
      navigate("/login");
    }
  }, [isLoading, user, error, navigate]);

  if (isLoading) {
    // Page-content loading → skeleton (design.md §8); no "..." text
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8" data-testid="auth-skeleton">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  // Signed in with Clerk, but the app could not load the local profile. Show
  // what went wrong and offer a way out — never bounce to /login, because the
  // session is valid and the redirect would just repeat.
  if (error) {
    return (
      <div
        className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4 py-10"
        data-testid="auth-error"
      >
        <h1 className="type-display-md text-[var(--color-ink)]">เข้าสู่ระบบไม่สำเร็จ</h1>
        <ErrorState
          title="ไม่สามารถโหลดข้อมูลบัญชีของคุณได้"
          description="คุณล็อกอินเรียบร้อยแล้ว แต่ระบบยังเชื่อมต่อข้อมูลบัญชีไม่ได้ กรุณาลองอีกครั้ง หรือแจ้งผู้ดูแลระบบหากยังพั้งอยู่"
          technical={error.serverMessage ?? `รหัสข้อผิดพลาด: ${error.status || "เครือข่าย"}`}
          onRetry={retry}
          retryLabel="ลองอีกครั้ง"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11">
            <Link href="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              void logout();
            }}
          >
            <LogOut size={ICON_SIZE.sm} aria-hidden="true" />
            ออกจากระบบ
          </Button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
