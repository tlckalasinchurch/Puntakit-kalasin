import { Home } from "lucide-react";
import { useLocation } from "wouter";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function NotFound() {
  usePageTitle("ไม่พบหน้าที่ต้องการ");
  const [, setLocation] = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas-soft)] p-5">
      <div className="w-full max-w-[420px] rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-10 text-center shadow-[var(--shadow)]">
        <p className="type-display-lg text-[var(--color-ink)]">404</p>

        <h1 className="type-lead mt-2 text-[var(--color-ink)]">ไม่พบหน้าที่ต้องการ</h1>

        <p className="type-caption mx-auto mt-2 max-w-[320px] text-[var(--color-body-muted)]">
          หน้าที่คุณกำลังมองหาอาจถูกย้ายหรือลบออกแล้ว กรุณากลับสู่หน้าหลัก
        </p>

        <button
          type="button"
          onClick={() => setLocation("/")}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
        >
          <Home size={ICON_SIZE.sm} aria-hidden="true" />
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}
