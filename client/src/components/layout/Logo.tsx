import { Cross } from "lucide-react";

export function Logo({ onLight = false }: { onLight?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white">
        <Cross size={22} strokeWidth={2.6} />
      </div>
      <div>
        <strong
          className={`block text-base font-bold tracking-tight leading-tight ${onLight ? "text-[var(--ink)]" : "text-white"}`}
        >
          Puntakit
        </strong>
        <span className="block text-[10px] font-semibold tracking-widest text-[var(--color-primary-on-dark)]">
          KALASIN CHURCH
        </span>
      </div>
    </div>
  );
}
