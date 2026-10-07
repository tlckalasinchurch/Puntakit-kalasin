import { Cross } from "lucide-react";

/**
 * The product mark. `tone` controls the wordmark colour rather than letting
 * each layout override it — the admin sidebar sits on graphite, the member PWA
 * header sits on white, and hardcoded `text-white` was unreadable on the latter.
 */
export function Logo({ tone = "onDark" }: { tone?: "onDark" | "onLight" }) {
  const wordmark =
    tone === "onDark" ? "text-[var(--color-on-dark)]" : "text-[var(--color-ink)]";
  const sub =
    tone === "onDark"
      ? "text-[var(--color-primary-on-dark)]"
      : "text-[var(--color-primary)]";

  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-on-dark)]"
      >
        <Cross size={22} strokeWidth={2.6} />
      </span>
      <span className="min-w-0">
        <strong className={`type-body-strong block leading-tight ${wordmark}`}>
          Puntakit
        </strong>
        <span className={`type-fine block font-semibold ${sub}`}>
          คริสตจักรชีวิตสุขสันต์กาฬสินธุ์
        </span>
      </span>
    </span>
  );
}
