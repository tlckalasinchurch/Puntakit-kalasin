import type { Basemap } from "@/components/Map";

/**
 * The [ แผนที่ถนน | ดาวเทียม ] pill that sits over the map's top-right corner.
 * Both options are real buttons (>= 44px) with `aria-pressed`; the selected one
 * is also bolder and filled, so state is not carried by colour alone.
 */
export function BasemapToggle({ value, onChange }: { value: Basemap; onChange: (next: Basemap) => void }) {
  const option = (id: Basemap, label: string) => (
    <button
      type="button"
      aria-pressed={value === id}
      onClick={() => onChange(id)}
      className={`type-caption-strong h-11 px-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)] ${
        value === id
          ? "bg-[var(--color-primary)] font-bold text-[var(--color-on-primary)]"
          : "text-[var(--color-body-muted)] hover:bg-[var(--color-canvas-soft)]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="รูปแบบแผนที่"
      className="absolute right-3 top-3 z-[500] inline-flex overflow-hidden rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
    >
      {option("street", "แผนที่ถนน")}
      {option("satellite", "ดาวเทียม")}
    </div>
  );
}
