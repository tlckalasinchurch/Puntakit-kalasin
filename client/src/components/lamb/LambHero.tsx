import { Link } from "wouter";
import { ArrowRight, Check } from "lucide-react";
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
      className="lamb-hero relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="relative z-10 max-w-md">
        <p
          id="lamb-hero-title"
          className="text-2xl font-bold text-[var(--color-ink)] sm:text-3xl"
        >
          ยินดีต้อนรับสู่
        </p>
        <p className="mt-1 text-4xl font-extrabold text-[#0C7C82] sm:text-5xl">
          Puntakit
        </p>
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
        <Link
          href="/app/reports/new"
          className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#0C7C82] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#0a6b70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82] focus-visible:ring-offset-2"
        >
          เริ่มบันทึกรายงาน
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <LambMascot
        pose="map"
        className="pointer-events-none absolute -right-4 -bottom-4 w-48 select-none sm:w-64"
      />
    </section>
  );
}
