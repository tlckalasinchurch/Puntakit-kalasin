import { Cross } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white">
        <Cross size={22} strokeWidth={2.6} />
      </div>
      <div>
        <strong className="block text-base font-bold text-white tracking-tight leading-tight">
          Puntakit
        </strong>
        <span className="block text-[10px] font-semibold tracking-widest text-[var(--color-primary-on-dark)]">
          KALASIN CHURCH
        </span>
      </div>
    </div>
  );
}
