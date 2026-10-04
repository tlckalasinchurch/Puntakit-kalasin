import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, ErrorState, InitialsAvatar, PageHeader } from "@/components/DesignSystem";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSkeleton } from "@/components/LoadingStates";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABELS } from "@shared/labels";
import { SUPER_ADMIN_ROLES, hasRole } from "@shared/roles";
import type { UserRole } from "@shared/schema";

/**
 * ผู้ใช้และสิทธิ์ — super admin only.
 *
 * Does two things: set a person's role, and choose which พันธกิจ they lead
 * (the owner field the group rules already read). Accounts are not created
 * here: a person appears after their first sign-in.
 */

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "suspended";
  careGroups: { id: string; name: string }[];
}
interface CareGroupOption {
  id: string;
  name: string;
  parentGroupId: string | null;
}

const INPUT_CLASS =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-base text-[var(--color-ink)] placeholder:text-[var(--color-text-quaternary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus)]/30";

/** Order used in the role menu: the roles a church team assigns most come first. */
const ROLE_ORDER: UserRole[] = ["group_leader", "staff", "ministry_leader", "admin", "super_admin", "member", "viewer"];

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const allowed = hasRole(me?.role, SUPER_ADMIN_ROLES);

  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ user: UserRow; role: UserRole } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.get<UserRow[]>("/api/admin/users"));
    } catch (err) {
      setError(errorText(err, "โหลดรายชื่อผู้ใช้ไม่สำเร็จ"));
    }
  }, []);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, search]);

  async function confirmRole() {
    if (!pending) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/users/${pending.user.id}/role`, { role: pending.role });
      toast.success(`เปลี่ยนบทบาทของ ${pending.user.name} เป็น ${ROLE_LABELS[pending.role]} แล้ว`);
      setPending(null);
      await load();
    } catch (err) {
      toast.error(errorText(err, "เปลี่ยนบทบาทไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <AppLayout>
        <PageHeader title="ผู้ใช้และสิทธิ์" />
        <EmptyState icon={ShieldCheck} title="หน้านี้สำหรับผู้ดูแลระบบสูงสุด" description="ติดต่อผู้ดูแลระบบสูงสุดเพื่อขอเปลี่ยนสิทธิ์" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="ผู้ใช้และสิทธิ์"
        description="กำหนดบทบาทและพันธกิจที่แต่ละคนดูแล ผู้ใช้จะอยู่ในรายการนี้หลังเข้าสู่ระบบครั้งแรก"
      />

      <div className="relative mb-4 max-w-md">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรืออีเมล"
          aria-label="ค้นหาผู้ใช้"
          className={`${INPUT_CLASS} pl-9`}
        />
      </div>

      {error ? (
        <ErrorState title="โหลดรายชื่อไม่สำเร็จ" description="กรุณาลองอีกครั้ง" technical={error} onRetry={load} />
      ) : !rows ? (
        <div role="status" aria-label="กำลังโหลดรายชื่อผู้ใช้">
          <ListSkeleton count={5} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={rows.length === 0 ? "ยังไม่มีผู้ใช้" : "ไม่พบผู้ใช้ที่ค้นหา"}
          description={rows.length === 0 ? "ให้แต่ละคนเข้าสู่ระบบด้วยอีเมลของตัวเองก่อน แล้วกลับมาตั้งสิทธิ์ที่หน้านี้" : "ลองค้นหาด้วยชื่อหรืออีเมลอื่น"}
        />
      ) : (
        <ul className="divide-y divide-[var(--color-hairline)] rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          {visible.map((u) => {
            const isMe = u.id === me?.id;
            return (
              <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <InitialsAvatar name={u.name} size={40} />
                  <div className="min-w-0">
                    <p className="type-body-strong truncate text-[var(--color-ink)]">
                      {u.name}
                      {isMe && <span className="type-caption ml-2 font-normal text-[var(--color-body-muted)]">(คุณ)</span>}
                      {u.status === "suspended" && <span className="type-caption ml-2 font-normal text-[var(--color-error)]">ถูกระงับ</span>}
                    </p>
                    <p className="type-caption truncate text-[var(--color-body-muted)]">{u.email}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:w-64">
                  <label className="sr-only" htmlFor={`role-${u.id}`}>
                    บทบาทของ {u.name}
                  </label>
                  <select
                    id={`role-${u.id}`}
                    value={u.role}
                    disabled={isMe}
                    onChange={(e) => setPending({ user: u, role: e.target.value as UserRole })}
                    className={`${INPUT_CLASS} pr-8 disabled:opacity-60`}
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setEditing(u)}
                    className="min-h-11 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                  >
                    {u.careGroups.length ? `ดูแล ${u.careGroups.length} พันธกิจ · แก้ไข` : "เลือกพันธกิจที่ดูแล"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pending && (
        <ConfirmDialog
          title="เปลี่ยนบทบาท"
          description={`เปลี่ยนบทบาทของ ${pending.user.name} จาก ${ROLE_LABELS[pending.user.role]} เป็น ${ROLE_LABELS[pending.role]} ใช่หรือไม่`}
          tone={pending.role === "super_admin" || pending.role === "admin" ? "danger" : "primary"}
          confirmLabel="เปลี่ยนบทบาท"
          busyLabel="กำลังบันทึก..."
          details={[pending.user.email]}
          isSubmitting={saving}
          onConfirm={confirmRole}
          onCancel={() => setPending(null)}
        />
      )}

      <CareGroupSheet
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </AppLayout>
  );
}

function CareGroupSheet({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [options, setOptions] = useState<CareGroupOption[] | null>(null);
  const [bodies, setBodies] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user) return;
    setConflicts(null);
    setPicked(new Set(user.careGroups.map((g) => g.id)));
    setQuery("");
    setLoadError(null);
    let cancelled = false;
    Promise.all([
      api.get<CareGroupOption[]>("/api/groups?orgLevel=care"),
      api.get<CareGroupOption[]>("/api/groups?orgLevel=body"),
    ])
      .then(([care, body]) => {
        if (cancelled) return;
        setOptions([...care].sort((a, b) => a.name.localeCompare(b.name, "th")));
        setBodies(new Map(body.map((b) => [b.id, b.name])));
      })
      .catch((err) => !cancelled && setLoadError(errorText(err, "โหลดรายการพันธกิจไม่สำเร็จ")));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const shown = (options ?? []).filter((o) => !query.trim() || o.name.includes(query.trim()));

  async function save(replaceExisting = false) {
    if (!user) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/users/${user.id}/care-groups`, { groupIds: Array.from(picked), replaceExisting });
      toast.success(`บันทึกพันธกิจของ ${user.name} แล้ว (${picked.size} พันธกิจ)`);
      setConflicts(null);
      await onSaved();
    } catch (err) {
      // 409: some groups already have another leader. Ask before taking them over.
      if (err instanceof ApiError && err.status === 409 && err.details?.length) {
        setConflicts(err.details.map((d) => d.message));
      } else {
        toast.error(errorText(err, "บันทึกไม่สำเร็จ"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={user !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="type-lead pr-8 text-[var(--color-ink)]">พันธกิจที่ {user?.name} ดูแล</SheetTitle>
          <SheetDescription className="type-caption text-[var(--color-body-muted)]">
            เลือกได้หลายพันธกิจ ถ้าพันธกิจมีหัวหน้าคนอื่นอยู่ ระบบจะถามยืนยันก่อนเปลี่ยน
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อพันธกิจ"
            aria-label="ค้นหาพันธกิจ"
            className={INPUT_CLASS}
          />
          {loadError ? (
            <ErrorState title="โหลดรายการไม่สำเร็จ" description="กรุณาปิดแล้วเปิดใหม่" technical={loadError} />
          ) : !options ? (
            <div role="status" aria-label="กำลังโหลดรายการพันธกิจ">
              <ListSkeleton count={5} />
            </div>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-[var(--color-hairline)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-hairline)]">
              {shown.map((o) => (
                <li key={o.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--color-canvas-soft)]">
                    <input
                      type="checkbox"
                      checked={picked.has(o.id)}
                      onChange={(e) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(o.id);
                          else next.delete(o.id);
                          return next;
                        })
                      }
                      className="size-5 accent-[var(--color-primary)]"
                    />
                    <span className="min-w-0">
                      <span className="type-body block truncate text-[var(--color-ink)]">{o.name}</span>
                      {o.parentGroupId && bodies.get(o.parentGroupId) && (
                        <span className="type-caption block truncate text-[var(--color-body-muted)]">{bodies.get(o.parentGroupId)}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
              {shown.length === 0 && <li className="type-caption px-3 py-6 text-center text-[var(--color-body-muted)]">ไม่พบพันธกิจที่ค้นหา</li>}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-hairline)] p-4">
          <span className="type-caption text-[var(--color-body-muted)]">เลือกแล้ว {picked.size} พันธกิจ</span>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saving || !options}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </SheetContent>
      {conflicts && (
        <ConfirmDialog
          title="เปลี่ยนหัวหน้าพันธกิจ"
          description="พันธกิจต่อไปนี้มีหัวหน้าอยู่แล้ว ถ้ายืนยัน หัวหน้าเดิมจะไม่ได้ดูแลพันธกิจเหล่านี้อีก"
          tone="danger"
          confirmLabel="ยืนยันเปลี่ยน"
          busyLabel="กำลังบันทึก..."
          details={conflicts}
          isSubmitting={saving}
          onConfirm={() => save(true)}
          onCancel={() => setConflicts(null)}
        />
      )}
    </Sheet>
  );
}
