import { Check } from "lucide-react";
import { StatusChip } from "@/components/DesignSystem";
import { LambMascot } from "./LambMascot";

const CHECKLIST = [
  "บันทึกรายงานได้ง่าย",
  "ติดตามความก้าวหน้า",
  "เห็นภาพรวมในแผนที่",
];

/**
 * Hero card for the Lamb Edition home — welcome message, checklist,
 * primary CTA to start a report, and the lamb holding a map.
 */
export function LambHero() {
  return (
    <section
      aria-labelledby="lamb-hero-title"
      className="lamb-hero relative isolate min-h-[340px] overflow-hidden rounded-[28px] border border-[var(--lamb-surface)] bg-[var(--lamb-surface)] p-6 shadow-[var(--shadow)] sm:p-8 lg:min-h-[420px] lg:p-10"
    >
      {/* Soft illustrated landscape keeps the hero warm without obscuring content.
          The tones are tokens, not literals: on a dark canvas the old sky/leaf
          hexes rendered as pale daytime blobs. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] overflow-hidden rounded-r-[28px] bg-[var(--lamb-sky)] lg:block"
      >
        <div className="absolute -right-12 top-2 h-52 w-72 rounded-full bg-[var(--lamb-sky-far)]/70" />
        <div className="absolute right-12 top-14 h-8 w-24 rounded-full bg-[var(--lamb-surface)]/60 blur-sm" />
        <div className="absolute -left-10 bottom-16 h-44 w-[120%] rounded-[50%] bg-[var(--lamb-leaf-far)]" />
        <div className="absolute -left-8 bottom-5 h-40 w-[115%] rounded-[50%] bg-[var(--lamb-leaf-mid)]" />
        <div className="absolute -right-12 -bottom-20 h-48 w-[90%] rounded-[50%] bg-[var(--lamb-leaf-near)]" />
      </div>
      <div className="relative z-10 max-w-md lg:max-w-[52%]">
        <h1
          id="lamb-hero-title"
          className="text-2xl font-bold text-[var(--color-ink)] sm:text-3xl"
        >
          ยินดีต้อนรับสู่
          <span className="mt-1 block text-4xl font-extrabold tracking-tight text-[var(--lamb-primary)] sm:text-5xl lg:text-6xl">
            Puntakit
          </span>
        </h1>
        <p className="mt-3 text-[var(--color-body-muted)]">
          ร่วมออกไป สร้างชีวิต เปลี่ยนชุมชน ด้วยพันธกิจบ้าน
        </p>
        <ul className="mt-4 space-y-2">
          {CHECKLIST.map(item => (
            <li key={item} className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-ink)]">
                <Check size={14} aria-hidden="true" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        {/* The report form for members is not built yet (POST /api/submissions is limited to CREATE_ROLES),
            so this is shown as unavailable instead of linking to a page that does not exist. */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled
            title="ฟอร์มบันทึกรายงานกำลังจัดเตรียม ยังไม่เปิดให้ใช้งาน"
            className="inline-flex min-h-12 cursor-not-allowed items-center gap-2 rounded-full bg-[var(--color-canvas-soft)] px-6 py-3 font-semibold text-[var(--color-body-muted)]"
          >
            เริ่มบันทึกรายงาน
          </button>
          <StatusChip tone="neutral">เร็วๆ นี้</StatusChip>
        </div>
      </div>
      <LambMascot
        pose="map"
        className="pointer-events-none absolute -right-4 bottom-0 z-10 w-40 select-none sm:w-52 lg:-right-2 lg:bottom-2 lg:w-[min(42%,300px)]"
      />
    </section>
  );
}
