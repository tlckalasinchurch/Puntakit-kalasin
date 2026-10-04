import { Link } from "wouter";

const LEGAL_LINK_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

/**
 * design.md §8: every login and profile page must link `/privacy` and
 * `/terms`. Rendered under the Clerk card so the requirement holds on every
 * auth branch — demo notice, session error, and the hosted Clerk widget.
 */
export function LegalLinks() {
  return (
    <div className="mt-6 border-t border-[var(--color-divider)] pt-4">
      <p className="type-fine text-center text-[var(--color-body-muted)]">
        การใช้งานต่อถือว่าคุณยอมรับข้อกำหนดต่อไปนี้
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link href="/privacy" className={LEGAL_LINK_CLASS}>
          นโยบายความเป็นส่วนตัว
        </Link>
        <Link href="/terms" className={LEGAL_LINK_CLASS}>
          เงื่อนไขการใช้งานระบบ
        </Link>
      </div>
    </div>
  );
}
