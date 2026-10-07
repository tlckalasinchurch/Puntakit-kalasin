import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { DataBar, ErrorState } from "@/components/DesignSystem";
import { api, ApiError } from "@/lib/api";

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

  useEffect(() => {
    let active = true;
    setError(null);
    api.get<Overview>("/api/org/overview").then(
      (d) => active && setData(d),
      (err) => active && setError(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err))
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  if (error) {
    return <ErrorState title="โหลดภาพรวมองค์กรไม่สำเร็จ" description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง" technical={error} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  if (!data) {
    return <div role="status" aria-label="กำลังโหลดภาพรวมองค์กร" className="card-surface h-64 animate-pulse motion-reduce:animate-none" />;
  }
  if (data.bodies.length === 0) return null;

  const max = Math.max(1, ...data.bodies.map((b) => b.memberCount));
  return (
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

      <Link href="/org" className="type-caption-strong mt-4 inline-flex min-h-11 items-center gap-1.5 text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]">
        เปิดผังองค์กร
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
