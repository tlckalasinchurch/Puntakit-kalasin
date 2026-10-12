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
      className="lamb-hero relative isolate min-h-[340px] overflow-hidden rounded-[28px] border border-white bg-white p-6 shadow-[0_10px_28px_rgba(29,29,31,0.08)] sm:p-8 lg:min-h-[420px] lg:p-10"
    >
      {/* Soft illustrated landscape keeps the hero warm without obscuring content. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] overflow-hidden rounded-r-[28px] bg-[#E4F7FC] lg:block">
        <div className="absolute -right-12 top-2 h-52 w-72 rounded-full bg-[#BAE6FD]/80" />
        <div className="absolute right-12 top-14 h-8 w-24 rounded-full bg-white/70 blur-sm" />
        <div className="absolute -left-10 bottom-16 h-44 w-[120%] rounded-[50%] bg-[#CBE9A1]" />
        <div className="absolute -left-8 bottom-5 h-40 w-[115%] rounded-[50%] bg-[#78C99A]" />
        <div className="absolute -right-12 -bottom-20 h-48 w-[90%] rounded-[50%] bg-[#37A978]" />
      </div>
      <div className="relative z-10 max-w-md lg:max-w-[52%]">
        <p
          id="lamb-hero-title"
          className="text-2xl font-bold text-[var(--color-ink)] sm:text-3xl"
        >
          ยินดีต้อนรับสู่
        </p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight text-[#087477] sm:text-5xl lg:text-6xl">
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
        className="pointer-events-none absolute -right-4 bottom-0 z-10 w-40 select-none sm:w-52 lg:-right-2 lg:bottom-2 lg:w-[min(42%,300px)]"
      />
    </section>
  );
}
