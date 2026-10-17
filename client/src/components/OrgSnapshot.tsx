import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { DataBar, ErrorState } from "@/components/DesignSystem";
import { api, ApiError } from "@/lib/api";
import { RecoveredNote, SectionHeldByBanner, usePageWideFailure, useReportFailure } from "@/components/home/homeFailures";
import { useRetryZone } from "@/components/home/useRetryZone";

/**
 * Home → organisation snapshot: totals plus one row per body, linking to the
 * org chart. Numbers come from `/api/org/overview`; an empty org shows
 * nothing rather than zeros dressed up as a dashboard.
 */

interface Overview {
  head: { name: string } | null;
  totals: { bodies: number; careGroups: number; members: number };
  bodies: { id: string; name: string; leaderName: string | null; careGroupCount: number; memberCount: number }[];
}

const th = new Intl.NumberFormat("th-TH");

export function OrgSnapshot() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setError(null);
    setLoading(true);
    api.get<Overview>("/api/org/overview").then(
      (d) => {
        if (!active) return;
        setData(d);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        setError(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err));
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  // Lets Home tell "this one query failed" from "several failed together" (one banner then).
  const pageWideFailure = usePageWideFailure();
  useReportFailure("org", error !== null, () => setAttempt((n) => n + 1), error ?? undefined, loading);

  // The error box stays mounted while its own retry runs, so focus on the button is not dropped;
  // when the retry works it is replaced by a short note that takes the focus (see useRetryZone).
  const zone = useRetryZone({ loading, failed: error ? 1 : 0 });
  const lastError = useRef<string | null>(null);
  if (error) lastError.current = error;
  const errorBox = (technical: string) => (
    <div ref={zone.rootRef}>
      <ErrorState
        title="โหลดภาพรวมองค์กรไม่สำเร็จ"
        description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง"
        technical={technical}
        retryBusy={zone.busy}
        onRetry={() => {
          if (zone.begin()) setAttempt((n) => n + 1);
        }}
      />
    </div>
  );
  if (zone.busy && lastError.current) return errorBox(lastError.current);
  if (error) {
    if (pageWideFailure) return <SectionHeldByBanner className="px-1 py-2" />;
    return errorBox(error);
  }
  if (!data) {
    return <div role="status" aria-label="กำลังโหลดภาพรวมองค์กร" className="card-surface h-64 animate-pulse motion-reduce:animate-none" />;
  }
  const recovered = zone.recovered ? (
    <div ref={zone.rootRef} className="mb-3">
      <RecoveredNote zone={zone} />
    </div>
  ) : null;
  if (data.bodies.length === 0) return recovered;

  const max = Math.max(1, ...data.bodies.map((b) => b.memberCount));
  return (
    <>
    {recovered}
    <section aria-labelledby="home-org" className="card-surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="home-org" className="type-body-strong text-[var(--color-ink)]">
            ภาพรวมองค์กร
          </h2>
          <p className="type-caption text-[var(--color-body-muted)]">
            {data.head ? `ศบ.อาจารย์ ${data.head.name}` : "ศบ.อาจารย์ · หัวหน้าทีม"}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-4 sm:gap-8">
          {[
            [data.totals.bodies, "บอดี้"],
            [data.totals.careGroups, "พันธกิจ"],
            [data.totals.members, "สมาชิก"],
          ].map(([value, label]) => (
            <div key={label as string}>
              <dd className="type-lead font-semibold tabular-nums text-[var(--color-ink)]">{th.format(value as number)}</dd>
              <dt className="type-caption text-[var(--color-body-muted)]">{label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <ul className="mt-5 divide-y divide-[var(--color-hairline)] border-t border-[var(--color-hairline)]">
        {data.bodies.map((b) => (
          <li key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <div className="min-w-0">
              <p className="type-body-strong truncate text-[var(--color-ink)]">{b.name}</p>
              <p className="type-caption truncate text-[var(--color-body-muted)]">
                {b.leaderName ? `หนบ. ${b.leaderName} · ` : ""}
                {b.careGroupCount} พันธกิจ
              </p>
            </div>
            <div className="hidden sm:block">
              <DataBar value={b.memberCount} max={max} label={`${b.name}: สมาชิก ${b.memberCount} คน`} />
            </div>
            <p className="type-body-strong text-right tabular-nums text-[var(--color-ink)]">
              {th.format(b.memberCount)}
              <span className="type-fine ml-1 font-normal text-[var(--color-body-muted)]">คน</span>
            </p>
          </li>
        ))}
      </ul>

      <Link href="/org" className="type-caption-strong mt-4 inline-flex min-h-11 items-center gap-1.5 text-[var(--color-primary-ink)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]">
        เปิดผังองค์กร
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
    </>
  );
}
