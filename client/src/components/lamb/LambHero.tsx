import { Check } from "lucide-react";
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
      className="lamb-hero relative isolate overflow-hidden rounded-[28px] border border-[var(--lamb-surface)] bg-[var(--lamb-surface)] p-6 pb-40 shadow-[var(--shadow)] sm:p-8 sm:pb-40 lg:min-h-[420px] lg:p-10"
    >
      {/* Soft illustrated landscape keeps the hero warm without obscuring content.
          The tones are tokens, not literals: on a dark canvas the old sky/leaf
          hexes rendered as pale daytime blobs.

          It is ONE panel at both sizes — a band under the copy on a phone, a
          panel beside it from lg up — so the hero reads as one object instead of
          a text block with a picture floating over it. The lamb lives INSIDE
          this panel at both breakpoints, which is what stops it being cropped by
          the section's own `overflow-hidden`. Base values are the phone band;
          the `lg` values re-tune the same five shapes for the taller panel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-36 overflow-hidden bg-[var(--lamb-sky)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[54%]"
      >
        <div className="absolute -right-8 top-2 h-32 w-44 rounded-full bg-[var(--lamb-sky-far)]/70 lg:-right-12 lg:h-52 lg:w-72" />
        {/* White, not --lamb-surface: the scene is daylight in both themes now,
            so a surface-coloured cloud would be a dark smudge on a light sky. */}
        <div className="absolute right-8 top-9 h-5 w-16 rounded-full bg-white/70 blur-sm lg:right-12 lg:top-14 lg:h-8 lg:w-24" />
        <div className="absolute -left-8 bottom-10 h-20 w-[125%] rounded-[50%] bg-[var(--lamb-leaf-far)] lg:-left-10 lg:bottom-16 lg:h-44 lg:w-[120%]" />
        <div className="absolute -left-6 bottom-2 h-16 w-[120%] rounded-[50%] bg-[var(--lamb-leaf-mid)] lg:-left-8 lg:bottom-5 lg:h-40 lg:w-[115%]" />
        <div className="absolute -bottom-8 -right-8 h-24 w-[95%] rounded-[50%] bg-[var(--lamb-leaf-near)] lg:-bottom-20 lg:-right-12 lg:h-48 lg:w-[90%]" />
      </div>
      {/* 42% is measured against the copy column, not the card: the panel takes the
          card's right 54%, and at 52% the paragraph ran underneath it and went
          unreadable against the daylight sky. */}
      <div className="relative z-10 max-w-md lg:max-w-[42%]">
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
        {/* The report form for members is not built yet (POST /api/submissions is limited to CREATE_ROLES,
            and /app/reports is a read-only list), so this is shown as unavailable instead of
            linking to a page that does not do the job.

            It has to read as closed, not as a live primary action: it was a teal wash at full
            opacity, which looked tappable while doing nothing. Now it is muted with a hairline
            edge, and the reason is visible text under it (a `title` tooltip never shows on a
            phone). Muted text on the soft canvas keeps its contrast, so it stays readable. */}
        <div className="mt-6 flex flex-col items-start gap-2">
          <button
            type="button"
            disabled
            aria-describedby="lamb-report-soon"
            className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas-soft)] px-6 py-3 text-center font-semibold text-[var(--color-body-muted)] sm:w-auto"
          >
            เริ่มบันทึกรายงาน
          </button>
          <p id="lamb-report-soon" className="type-caption text-[var(--color-body-muted)]">
            เร็วๆ นี้ — ฟอร์มบันทึกรายงานสำหรับสมาชิกกำลังจัดเตรียม
          </p>
        </div>
      </div>
      <LambMascot
        pose="map"
        className="pointer-events-none absolute bottom-3 right-3 z-10 w-40 select-none lg:bottom-8 lg:right-6 lg:w-[min(34%,250px)]"
      />
    </section>
  );
}
