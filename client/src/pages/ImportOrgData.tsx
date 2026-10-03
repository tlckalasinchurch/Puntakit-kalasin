import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, PageHeader } from "@/components/DesignSystem";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ADMIN_ROLES, hasRole } from "@shared/roles";

/**
 * Admin → โหลดข้อมูลผังองค์กร. The admin picks the prepared dataset file
 * (JSON) from their own device. The file is sent to the API, never stored in
 * the repository and never shown back on screen: only counts are displayed.
 * Order of use: ตรวจสอบก่อน (dry-run) → โหลดข้อมูล → (ถ้าจำเป็น) ถอนกลับ.
 */

interface Plan {
  people: number;
  bodies: number;
  careGroups: number;
  members: number;
  groupMembers: number;
  nameFromNickname: number;
}
interface DryRun {
  plan: Plan;
  alreadyPresent: { members: number; groups: number };
  targetBefore: { members: number; groups: number };
}
interface Done {
  plan: Plan;
  targetBefore: { members: number; groups: number };
  targetAfter: { members: number; groups: number };
}

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const PRIMARY = `${BUTTON} bg-[var(--color-primary)] text-[var(--color-on-dark)] hover:bg-[var(--color-primary-focus)]`;
const OUTLINE = `${BUTTON} border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas-soft)]`;

export default function ImportOrgData() {
  const { user } = useAuth();
  const isAdmin = hasRole(user?.role, ADMIN_ROLES);
  const [dataset, setDataset] = useState<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [dry, setDry] = useState<DryRun | null>(null);
  const [done, setDone] = useState<(Done & { kind: "apply" | "rollback" }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"apply" | "rollback" | null>(null);

  if (!isAdmin) {
    return (
      <AppLayout>
        <PageHeader title="โหลดข้อมูลผังองค์กร" description="โหลดบอดี้ แคร์ และสมาชิกจากไฟล์ข้อมูลที่เตรียมไว้" />
        <EmptyState icon={Lock} title="ไม่มีสิทธิ์เข้าถึง" description="หน้านี้จำกัดเฉพาะผู้ดูแลระบบ" />
      </AppLayout>
    );
  }

  const readFile = async (file: File | undefined) => {
    setDry(null);
    setDone(null);
    setError(null);
    setDataset(null);
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      setDataset({
        org_hierarchy: parsed.org_hierarchy,
        care_groups: parsed.care_groups,
        members: parsed.members,
      });
      setFileName(file.name);
    } catch {
      setError("อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ JSON ที่เตรียมไว้");
    }
  };

  const run = async <T,>(path: string, confirm: boolean): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await api.post<T>(`/api/org-data/${path}`, { dataset, confirm });
    } catch (err) {
      setError(err instanceof ApiError ? (err.serverMessage ?? err.message) : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const onDryRun = async () => {
    setDone(null);
    const result = await run<DryRun>("dry-run", false);
    if (result) setDry(result);
  };
  const onApply = async () => {
    const result = await run<Done>("apply", true);
    setConfirming(null);
    if (result) {
      setDone({ ...result, kind: "apply" });
      toast.success("โหลดข้อมูลเรียบร้อยแล้ว");
    }
  };
  const onRollback = async () => {
    const result = await run<Done>("rollback", true);
    setConfirming(null);
    if (result) {
      setDone({ ...result, kind: "rollback" });
      setDry(null);
      toast.success("ถอนกลับเรียบร้อยแล้ว");
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="โหลดข้อมูลผังองค์กร"
        description="โหลดบอดี้ แคร์ และสมาชิกจากไฟล์ข้อมูลที่เตรียมไว้ ระบบเพิ่มข้อมูลเท่านั้น และรันซ้ำได้โดยไม่เกิดข้อมูลซ้ำ"
        secondaryActions={[{ label: "กลับไปหน้านำเข้าจาก Excel", href: "/import" }]}
      />

      <section className="card-surface mb-4 p-4 sm:p-5">
        <label htmlFor="org-dataset" className="type-caption-strong block text-[var(--color-ink)]">
          ไฟล์ข้อมูล (puntakit_dataset.json)
        </label>
        <input
          id="org-dataset"
          type="file"
          accept="application/json,.json"
          onChange={(e) => void readFile(e.target.files?.[0])}
          className="mt-1.5 block w-full text-sm"
        />
        {fileName && dataset !== null && (
          <p className="type-caption mt-2 text-[var(--color-body-muted)]">เลือกไฟล์แล้ว: {fileName}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={OUTLINE} disabled={busy || dataset === null} onClick={() => void onDryRun()}>
            ตรวจสอบก่อน (ยังไม่บันทึก)
          </button>
          <button type="button" className={PRIMARY} disabled={busy || !dry} onClick={() => setConfirming("apply")}>
            โหลดข้อมูล
          </button>
          <button type="button" className={OUTLINE} disabled={busy || dataset === null} onClick={() => setConfirming("rollback")}>
            ถอนกลับ
          </button>
        </div>
        {error && (
          <p role="alert" className="type-caption mt-3 text-[var(--color-danger,#b42318)]">
            {error}
          </p>
        )}
      </section>

      {dry && (
        <section className="card-surface mb-4 p-4 sm:p-5" aria-label="ผลการตรวจสอบ">
          <h2 className="type-body-strong text-[var(--color-ink)]">ผลการตรวจสอบ (ยังไม่มีการบันทึก)</h2>
          <ul className="type-caption mt-2 space-y-1 text-[var(--color-body-muted)]">
            <li>ผู้นำ: {dry.plan.people} คน · บอดี้: {dry.plan.bodies} · แคร์: {dry.plan.careGroups} · สมาชิก: {dry.plan.members} คน</li>
            <li>ใช้ชื่อเล่นแทนชื่อ-สกุล: {dry.plan.nameFromNickname} คน</li>
            <li>มีอยู่แล้วในระบบ: สมาชิก {dry.alreadyPresent.members} · กลุ่ม {dry.alreadyPresent.groups}</li>
            <li>ก่อนโหลด ระบบมี: สมาชิก {dry.targetBefore.members} · กลุ่ม {dry.targetBefore.groups}</li>
          </ul>
        </section>
      )}

      {done && (
        <section className="card-surface mb-4 p-4 sm:p-5" aria-label="ผลลัพธ์">
          <h2 className="type-body-strong text-[var(--color-ink)]">
            {done.kind === "apply" ? "โหลดข้อมูลเรียบร้อยแล้ว" : "ถอนกลับเรียบร้อยแล้ว"}
          </h2>
          <ul className="type-caption mt-2 space-y-1 text-[var(--color-body-muted)]">
            <li>สมาชิก: {done.targetBefore.members} → {done.targetAfter.members}</li>
            <li>กลุ่ม: {done.targetBefore.groups} → {done.targetAfter.groups}</li>
          </ul>
        </section>
      )}

      {confirming === "apply" && dry && (
        <ConfirmDialog
          title="ยืนยันการโหลดข้อมูลเข้าระบบ"
          description="ระบบจะเพิ่มข้อมูลใหม่เท่านั้น ไม่แก้หรือลบข้อมูลเดิม และรันซ้ำได้โดยไม่เกิดข้อมูลซ้ำ"
          details={[
            `บอดี้ ${dry.plan.bodies} · แคร์ ${dry.plan.careGroups}`,
            `สมาชิก ${dry.plan.members} คน · ผู้นำ ${dry.plan.people} คน`,
            `ใช้ชื่อเล่นแทนชื่อ-สกุล ${dry.plan.nameFromNickname} คน`,
          ]}
          tone="primary"
          confirmLabel="โหลดข้อมูล"
          busyLabel="กำลังโหลด…"
          isSubmitting={busy}
          onConfirm={() => void onApply()}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "rollback" && (
        <ConfirmDialog
          title="ยืนยันการถอนกลับ"
          description="ระบบจะลบบอดี้ แคร์ และสมาชิกที่โหลดจากไฟล์นี้ รวมถึงการแก้ไขที่ทำกับข้อมูลเหล่านั้นภายหลัง ข้อมูลอื่นไม่ถูกแตะ"
          confirmLabel="ถอนกลับ"
          busyLabel="กำลังถอนกลับ…"
          isSubmitting={busy}
          onConfirm={() => void onRollback()}
          onCancel={() => setConfirming(null)}
        />
      )}
    </AppLayout>
  );
}
