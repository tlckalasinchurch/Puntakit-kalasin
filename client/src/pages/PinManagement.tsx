import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Search, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, ErrorState, InitialsAvatar, PageHeader } from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { SUPER_ADMIN_ROLES, hasRole } from "@shared/roles";
import type { UserRole } from "@shared/schema";
import { toast } from "sonner";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "suspended";
  pinConfigured: boolean;
  ledGroups: { id: string; name: string; orgLevel: "body" | "care" | null; as: "leader" | "co_leader" }[];
}

const INPUT_CLASS =
  "min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-base text-[var(--color-ink)] placeholder:text-[var(--color-text-quaternary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus)]/30";

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

export default function PinManagement() {
  const { user: me } = useAuth();
  const allowed = hasRole(me?.role, SUPER_ADMIN_ROLES);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api.get<UserRow[]>("/api/admin/users"));
    } catch (err) {
      setError(errorText(err, "โหลดรายชื่อผู้ดูแลบอดี้ไม่สำเร็จ"));
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const bodyUsers = useMemo(
    () =>
      (rows ?? [])
        .map((row) => ({ ...row, bodies: row.ledGroups.filter((group) => group.orgLevel === "body") }))
        .filter((row) => row.bodies.length > 0)
        .filter((row) => {
          const query = search.trim().toLowerCase();
          return !query || row.name.toLowerCase().includes(query) || row.email.toLowerCase().includes(query) || row.bodies.some((body) => body.name.toLowerCase().includes(query));
        }),
    [rows, search]
  );

  if (!allowed) {
    return (
      <AppLayout>
        <PageHeader title="จัดการ PIN บอดี้" />
        <EmptyState icon={ShieldCheck} title="หน้านี้สำหรับผู้ดูแลระบบสูงสุด" description="ติดต่อ Super admin เพื่อจัดการ PIN" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="จัดการ PIN บอดี้"
        description="Super admin ตั้งหรือเปลี่ยน PIN สำหรับผู้ดูแลบอดี้ได้จากหน้านี้"
      />

      <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 shrink-0 text-[var(--color-primary)]" size={20} aria-hidden="true" />
          <p className="type-caption text-[var(--color-body-muted)]">
            PIN ต้องเป็นตัวเลข 6 หลัก ระบบจะเก็บเป็นค่าที่เข้ารหัสและไม่แสดง PIN เดิมบนหน้าจอ
          </p>
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่อผู้ดูแลหรือชื่อบอดี้"
          aria-label="ค้นหาชื่อผู้ดูแลหรือชื่อบอดี้"
          className={`${INPUT_CLASS} pl-9`}
        />
      </div>

      {error ? (
        <ErrorState title="โหลดรายชื่อไม่สำเร็จ" description="กรุณาลองอีกครั้ง" technical={error} onRetry={load} />
      ) : !rows ? (
        <div role="status" aria-label="กำลังโหลดรายชื่อผู้ดูแลบอดี้">
          <ListSkeleton count={5} />
        </div>
      ) : bodyUsers.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={rows.length === 0 ? "ยังไม่มีผู้ใช้ในระบบ" : "ยังไม่พบผู้ดูแลบอดี้"}
          description="ตรวจสอบว่าผู้ใช้ถูกผูกเป็นหัวหน้าหรือผู้ช่วยหัวหน้าของบอดี้แล้ว"
        />
      ) : (
        <ul className="divide-y divide-[var(--color-hairline)] rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          {bodyUsers.map((user) => (
            <li key={user.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <InitialsAvatar name={user.name} size={44} />
                <div className="min-w-0">
                  <p className="type-body-strong truncate text-[var(--color-ink)]">{user.name}</p>
                  <p className="type-caption truncate text-[var(--color-body-muted)]">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {user.bodies.map((body) => (
                      <span key={`${user.id}-${body.id}`} className="type-caption rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 px-2.5 py-0.5 text-[var(--color-ink)]">
                        {body.as === "leader" ? "หัวหน้า" : "ผู้ช่วยหัวหน้า"} · {body.name.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <span className={`type-caption ${user.pinConfigured ? "text-[var(--color-success)]" : "text-[var(--color-body-muted)]"}`}>
                  {user.pinConfigured ? "ตั้ง PIN แล้ว" : "ยังไม่ได้ตั้ง PIN"}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(user)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
                >
                  <KeyRound size={16} aria-hidden="true" />
                  {user.pinConfigured ? "เปลี่ยน PIN" : "ตั้ง PIN"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PinEditor user={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
    </AppLayout>
  );
}

function PinEditor({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setPin("");
      setConfirmPin("");
    }
  }, [user]);

  async function save() {
    if (!user || pin.length !== 6 || pin !== confirmPin) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/users/${user.id}/pin`, { pin });
      toast.success(`บันทึก PIN ของ ${user.name} แล้ว`);
      await onSaved();
    } catch (err) {
      toast.error(errorText(err, "บันทึก PIN ไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="type-lead pr-8 text-[var(--color-ink)]">ตั้ง PIN ให้ {user?.name}</SheetTitle>
          <SheetDescription className="type-caption text-[var(--color-body-muted)]">กรอก PIN ใหม่ 6 หลัก และยืนยันอีกครั้ง</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 px-4">
          <label className="grid gap-2 text-sm font-semibold text-[var(--color-ink)]">
            PIN ใหม่
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className={INPUT_CLASS}
              placeholder="ตัวเลข 6 หลัก"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--color-ink)]">
            ยืนยัน PIN ใหม่
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className={INPUT_CLASS}
              placeholder="กรอกซ้ำอีกครั้ง"
            />
          </label>
          {confirmPin.length > 0 && pin !== confirmPin && <p className="type-caption text-[var(--color-error-ink)]">PIN ไม่ตรงกัน</p>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-hairline)] p-4">
          <button type="button" onClick={onClose} className="min-h-11 rounded-[var(--radius-pill)] px-4 text-sm font-semibold text-[var(--color-body-muted)] hover:bg-[var(--color-canvas-soft)]">ยกเลิก</button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || pin.length !== 6 || pin !== confirmPin}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก PIN"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
