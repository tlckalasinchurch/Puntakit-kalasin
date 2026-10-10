import { Link, useLocation } from "wouter";
import { Check } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";

/**
 * Wizard stepper for the Excel import flow (Phase 4).
 *
 * The import pages already exist as sub-routes under /import — this component
 * adds the missing progress context so users know where they are:
 *
 *   ① อัปโหลด (/import) → ② ตรวจสอบ (/import/duplicates) → ③ อนุมัติ (/import/merge-approvals)
 *
 * /import/org is a separate domain (org structure, not member import) and
 * does not participate in this flow.
 *
 * Pure presentation — no business logic, no API calls.
 */
const STEPS = [
  { label: "อัปโหลด", path: "/import" },
  { label: "ตรวจสอบ", path: "/import/duplicates" },
  { label: "อนุมัติ", path: "/import/merge-approvals" },
] as const;

export function ImportStepper() {
  const [location] = useLocation();

  const currentIndex = STEPS.findIndex(step => location === step.path);

  return (
    <nav aria-label="ขั้นตอนการนำเข้าข้อมูล" className="mb-6">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isComplete = currentIndex > index;
          const isUpcoming = currentIndex === -1 || index > currentIndex;

          return (
            <li key={step.path} className="flex flex-1 items-center last:flex-none">
              <Link
                href={step.path}
                aria-current={isCurrent ? "step" : undefined}
                className="group flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    isComplete
                      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                      : isCurrent
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] ring-2 ring-[var(--color-primary-focus)] ring-offset-2"
                        : "bg-[var(--color-canvas-soft)] text-[var(--color-body-muted)]"
                  }`}
                >
                  {isComplete ? <Check size={ICON_SIZE.sm} /> : <span>{index + 1}</span>}
                </span>
                <span
                  className={`type-caption-strong hidden sm:block ${
                    isCurrent
                      ? "text-[var(--color-ink)]"
                      : isUpcoming
                        ? "text-[var(--color-body-muted)]"
                        : "text-[var(--color-body-muted)]"
                  }`}
                >
                  {step.label}
                </span>
              </Link>
              {index < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`mx-1 h-px flex-1 sm:mx-2 ${
                    isComplete ? "bg-[var(--color-primary)]" : "bg-[var(--color-hairline)]"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
