import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Lock, Pencil, Plus, Search, UserPlus, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DataBar, EmptyState, ErrorState, InitialsAvatar, PageHeader } from "@/components/DesignSystem";
import { usePageTitle } from "@/hooks/usePageTitle";
import { CardGridSkeleton, ListSkeleton } from "@/components/LoadingStates";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Link } from "wouter";
import { buttonVariants } from "@/components/ui/button";
import { ADMIN_ROLES, PRIVILEGED_ROLES, hasRole } from "@shared/roles";

/**
 * ผังองค์กร: ศบ. → บอดี้ → พันธกิจ → สมาชิก.
 *
 * Reading order is the hierarchy itself. One selected body at a time keeps the
 * screen to three levels of information (leadership, bodies, care groups of
 * the chosen body); members open in a side sheet so the list never loses its
 * place. Every number comes from `/api/org/*` — nothing here is invented.
 */

interface CareGroupSummary {
  id: string;
  name: string;
  area: string | null;
  memberCount: number;
  careLeaderName: string | null;
  coordinatorName: string | null;
  careCode: string | null;
}
interface BodySummary {
  id: string;
  name: string;
  leaderName: string | null;
  careGroupCount: number;
  memberCount: number;
  careGroups: CareGroupSummary[];
}
interface Overview {
  head: { id: string; name: string } | null;
  totals: { bodies: number; careGroups: number; members: number };
  bodies: BodySummary[];
  unassignedCareGroups: number;
}
interface MemberRow {
  id: string;
  name: string;
  nickname: string | null;
  age: number | null;
  ageRaw: string | null;
  occupation: string | null;
  workplace: string | null;
  beliefYear: string | null;
  goal: string | null;
  builder: string | null;
  nameMissing: boolean;
}
interface CareGroupDetail {
  group: CareGroupSummary & { location: string | null; bodyName: string | null };
  members: MemberRow[];
}

const th = new Intl.NumberFormat("th-TH");

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="type-display-md tabular-nums text-[var(--color-ink)]">{th.format(value)}</p>
      <p className="type-caption text-[var(--color-body-muted)]">{label}</p>
    </div>
  );
}

export default function OrgChart() {
  usePageTitle("ผังองค์กร");
  const { user } = useAuth();
  const canRead = hasRole(user?.role, PRIVILEGED_ROLES);
  // Adding, editing and deleting live on /groups and /members; admins get shortcuts here.
  const canManage = hasRole(user?.role, ADMIN_ROLES);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bodyId, setBodyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<CareGroupSummary | null>(null);
  const [detail, setDetail] = useState<CareGroupDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const overview = await api.get<Overview>("/api/org/overview");
      setData(overview);
      setBodyId((current) => current ?? overview.bodies[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err));
    }
  }, []);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  useEffect(() => {
    setDetail(null);
    setDetailError(null);
    if (!open) return;
    let cancelled = false;
    api
      .get<CareGroupDetail>(`/api/org/care-groups/${open.id}/members`)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setDetailError(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err)));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const body = data?.bodies.find((b) => b.id === bodyId) ?? null;
  const maxBody = Math.max(1, ...(data?.bodies.map((b) => b.memberCount) ?? [1]));
  const maxCare = Math.max(1, ...(body?.careGroups.map((c) => c.memberCount) ?? [1]));
  const careGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = body?.careGroups ?? [];
    if (!q) return list;
    return list.filter((c) =>
      [c.name, c.area, c.careLeaderName, c.coordinatorName].some((v) => v?.toLowerCase().includes(q))
    );
  }, [body, query]);

  if (!canRead) {
    return (
      <AppLayout>
        <PageHeader title="ผังองค์กร" description="ดูโครงสร้าง บอดี้ พันธกิจ และสมาชิก" />
        <EmptyState icon={Lock} title="ไม่มีสิทธิ์เข้าถึง" description="หน้านี้จำกัดเฉพาะเจ้าหน้าที่และผู้ดูแลระบบ" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="ผังองค์กร"
        description="เลือกบอดี้เพื่อดูพันธกิจ แล้วเลือกพันธกิจเพื่อดูรายชื่อสมาชิก"
        primaryAction={canManage ? { label: "เพิ่มบอดี้", icon: Plus, href: "/groups?new=body" } : undefined}
        secondaryActions={[
          { label: "รายการพันธกิจ", href: "/groups" },
          { label: "สมาชิกทั้งหมด", href: "/members" },
        ]}
      />

      {error ? (
        <ErrorState title="โหลดผังองค์กรไม่สำเร็จ" description="ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง" technical={error} onRetry={() => void load()} />
      ) : !data ? (
        <div role="status" aria-label="กำลังโหลดผังองค์กร">
          <CardGridSkeleton count={6} />
        </div>
      ) : data.bodies.length === 0 ? (
        <EmptyState title="ยังไม่มีบอดี้ในผัง" description="สร้างกลุ่มระดับบอดี้ที่หน้ากลุ่ม หรือโหลดข้อมูลผังองค์กรที่หน้านำเข้าจาก Excel" />
      ) : (
        <div className="space-y-8">
          {/* Level 1 — leadership and totals */}
          <section aria-label="ภาพรวม" className="card-surface flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <InitialsAvatar name={data.head?.name ?? "ศ"} size={56} />
              <div className="min-w-0">
                <p className="type-body-strong text-[var(--color-ink)]">{data.head?.name ?? "ยังไม่ระบุ ศบ.อาจารย์"}</p>
                <p className="type-caption text-[var(--color-body-muted)]">ศบ.อาจารย์ · หัวหน้าทีม ดูภาพรวมทุกบอดี้</p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-6">
              <Stat value={data.totals.bodies} label="บอดี้" />
              <Stat value={data.totals.careGroups} label="พันธกิจ" />
              <Stat value={data.totals.members} label="สมาชิก" />
            </dl>
          </section>

          {/* Level 2 — bodies */}
          <section aria-labelledby="org-bodies">
            <h2 id="org-bodies" className="type-body-strong mb-3 text-[var(--color-ink)]">
              บอดี้
            </h2>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {data.bodies.map((b) => {
                const selected = b.id === bodyId;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setBodyId(b.id);
                        setQuery("");
                      }}
                      aria-pressed={selected}
                      className={`flex min-h-11 w-full flex-col gap-3 rounded-[var(--radius-lg)] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] ${
                        selected
                          ? "border-[var(--color-primary)] bg-[var(--color-canvas)] ring-1 ring-[var(--color-primary)]"
                          : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-canvas-soft)]"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="type-body-strong block truncate text-[var(--color-ink)]">{b.name}</span>
                          {b.leaderName && (
                            <span className="type-caption line-clamp-2 text-[var(--color-body-muted)]">หนบ. {b.leaderName}</span>
                          )}
                        </span>
                        <span className="text-right">
                          <span className="type-body-strong block tabular-nums text-[var(--color-ink)]">{th.format(b.memberCount)}</span>
                          <span className="type-fine block text-[var(--color-body-muted)]">สมาชิก</span>
                        </span>
                      </span>
                      <DataBar value={b.memberCount} max={maxBody} label={`${b.name}: สมาชิก ${b.memberCount} คน`} />
                      <span className="type-caption text-[var(--color-body-muted)]">{b.careGroupCount} พันธกิจ</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Level 3 — care groups of the selected body */}
          {body && (
            <section aria-labelledby="org-care" className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="org-care" className="type-body-strong text-[var(--color-ink)]">
                    พันธกิจใน{body.name}
                  </h2>
                  <p className="type-caption text-[var(--color-body-muted)]">
                    {body.careGroupCount} พันธกิจ · {th.format(body.memberCount)} สมาชิก
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/groups?new=care&parent=${body.id}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-dark)] hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] focus-visible:ring-offset-2"
                    >
                      <Plus size={16} aria-hidden="true" />
                      เพิ่มพันธกิจ
                    </Link>
                    <Link
                      href={`/groups?edit=${body.id}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                    >
                      <Pencil size={16} aria-hidden="true" />
                      แก้ไข/ลบบอดี้
                    </Link>
                  </div>
                )}
                {body.careGroups.length > 6 && (
                  <label className="relative block sm:w-72">
                    <span className="sr-only">ค้นหาพันธกิจ</span>
                    <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body-muted)]" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="ค้นหาพันธกิจ ชื่อ หรือ หนค."
                      className="min-h-11 w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-9 pr-3 text-sm text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                    />
                  </label>
                )}
              </div>

              {careGroups.length === 0 ? (
                <EmptyState title={body.careGroups.length === 0 ? "บอดี้นี้ยังไม่มีพันธกิจ" : "ไม่พบพันธกิจที่ค้นหา"} description={body.careGroups.length === 0 ? "เพิ่มพันธกิจใต้บอดี้นี้ได้ที่หน้ากลุ่ม" : "ลองใช้คำอื่น หรือล้างช่องค้นหา"} />
              ) : (
                <ul className="card-surface divide-y divide-[var(--color-hairline)] overflow-hidden p-0">
                  {careGroups.map((c) => (
                    <li key={c.id} className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => setOpen(c)}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)] sm:px-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="type-body-strong block truncate text-[var(--color-ink)]">{c.name}</span>
                          <span className="type-caption block truncate text-[var(--color-body-muted)]">
                            {[c.area && `อ.${c.area}`, c.careLeaderName && `หนค. ${c.careLeaderName}`].filter(Boolean).join(" · ") || "ยังไม่ระบุ หนค."}
                          </span>
                        </span>
                        <span className="hidden w-28 sm:block">
                          <DataBar value={c.memberCount} max={maxCare} label={`${c.name}: สมาชิก ${c.memberCount} คน`} />
                        </span>
                        <span className="w-14 text-right">
                          <span className="type-body-strong block tabular-nums text-[var(--color-ink)]">{c.memberCount.toLocaleString("th-TH")}</span>
                          <span className="type-fine block text-[var(--color-body-muted)]">คน</span>
                        </span>
                        <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--color-body-muted)]" />
                      </button>
                      {canManage && (
                        <Link
                          href={`/groups?edit=${c.id}`}
                          aria-label={`แก้ไขพันธกิจ ${c.name}`}
                          className="flex w-11 shrink-0 items-center justify-center text-[var(--color-body-muted)] hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)]"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      {/* Level 4 — members of the chosen care group */}
      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="type-lead text-[var(--color-ink)]">{open?.name}</SheetTitle>
            <SheetDescription className="type-caption text-[var(--color-body-muted)]">
              {[detail?.group.bodyName, detail?.group.careLeaderName && `หนค. ${detail.group.careLeaderName}`, detail?.group.coordinatorName && `ผู้ประสานงาน ${detail.group.coordinatorName}`]
                .filter(Boolean)
                .join(" · ") || "รายชื่อสมาชิกในพันธกิจ"}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {canManage && open && (
              <div className="mb-3 flex flex-wrap gap-2">
                <Link href={`/members?new=1&care=${open.id}`} className={buttonVariants({ variant: "default", className: "min-h-11" })}>
                  <UserPlus size={16} aria-hidden="true" />
                  เพิ่มสมาชิกใหม่ในพันธกิจนี้
                </Link>
                <Link href={`/members?care=${open.id}`} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>
                  <Users size={16} aria-hidden="true" />
                  จัดการสมาชิก
                </Link>
              </div>
            )}
            {detailError ? (
              <ErrorState title="โหลดรายชื่อไม่สำเร็จ" description="กรุณาลองเปิดพันธกิจนี้อีกครั้ง" technical={detailError} onRetry={() => open && setOpen({ ...open })} />
            ) : !detail ? (
              <div role="status" aria-label="กำลังโหลดรายชื่อ">
                <ListSkeleton count={5} />
              </div>
            ) : detail.members.length === 0 ? (
              <EmptyState title="ยังไม่มีสมาชิกในพันธกิจนี้" description="เพิ่มสมาชิกได้ที่หน้ากลุ่ม" />
            ) : (
              <>
              {detail.members.some((m) => m.nameMissing) && (
                <p className="type-caption mb-2 rounded-[var(--radius-md)] bg-[var(--color-canvas-soft)] px-3 py-2 text-[var(--color-body-muted)]">
                  ยังไม่มีชื่อ-สกุลของสมาชิก {detail.members.filter((m) => m.nameMissing).length} คน ระบบแสดงชื่อเล่นแทน เพิ่มชื่อ-สกุลได้ที่หน้าสมาชิก
                </p>
              )}
              <ul className="divide-y divide-[var(--color-hairline)]">
                {detail.members.map((m) => {
                  const facts = [m.age !== null ? `${m.age} ปี` : m.ageRaw && `อายุ ${m.ageRaw}`, m.occupation, m.workplace].filter(Boolean).join(" · ");
                  return (
                    <li key={m.id} className="flex gap-3 py-3">
                      <InitialsAvatar name={m.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="type-body-strong truncate text-[var(--color-ink)]">
                          {m.name}
                          {!m.nameMissing && m.nickname ? <span className="type-caption ml-2 font-normal text-[var(--color-body-muted)]">({m.nickname})</span> : null}
                        </p>
                        {facts && <p className="type-caption truncate text-[var(--color-body-muted)]">{facts}</p>}
                        {(m.goal || m.beliefYear) && (
                          <p className="type-caption truncate text-[var(--color-body-muted)]">
                            {[m.goal, m.beliefYear && `รับเชื่อ ${m.beliefYear}`].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
