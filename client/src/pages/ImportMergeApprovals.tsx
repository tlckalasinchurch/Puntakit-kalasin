import { useCallback, useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { ImportStepper } from "@/components/ImportStepper";
import { EmptyState, ErrorState, Field, PageHeader, StatusChip, type StatusTone } from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ADMIN_ROLES, PRIVILEGED_ROLES, hasRole } from "@shared/roles";
import {
  IMPORT_MERGE_FIELDS,
  IMPORT_MERGE_FIELD_LABELS,
  IMPORT_MERGE_NOTE_MAX,
  IMPORT_MERGE_PLAN_STATUS_LABELS,
  IMPORT_MERGE_PLAN_STATUSES,
  IMPORT_MERGE_REQUIRES_SECOND_REVIEWER,
  type ImportMergeField,
  type ImportMergePlanStatus,
} from "@shared/importMerge";

/**
 * Admin → อนุมัติแผนรวมข้อมูลซ้ำ (§17). A second admin approves or rejects a
 * merge PLAN proposed on the duplicate-review screen.
 *
 * Approval records agreement and nothing else: rows are not merged and
 * members/groups (L3) are not written. The screen says so wherever a plan is
 * shown as approved.
 */

interface PlanMember {
  id: string;
  sheetName: string;
  excelRow: number;
  sourceFileName: string;
  rawFullName: string | null;
  rawAge: string | null;
  rawOccupation: string | null;
  rawWorkplace: string | null;
}

interface Plan {
  id: string;
  nickname: string;
  status: ImportMergePlanStatus;
  note: string | null;
  primarySourceRowId: string;
  result: Record<ImportMergeField, { fromRowId: string; value: string | null }>;
  members: PlanMember[];
  proposedById: string | null;
  proposedByName: string | null;
  proposedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

interface PlansResponse {
  plans: Plan[];
  requiresSecondReviewer: boolean;
  note: string;
}

type StatusFilter = ImportMergePlanStatus | "all";

const STATUS_TONE: Record<ImportMergePlanStatus, StatusTone> = {
  proposed: "info",
  approved: "success",
  rejected: "neutral",
  withdrawn: "neutral",
};

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";
const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const SECONDARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

const messageOf = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function PlanCard({ plan, userId, canAct, onDone }: { plan: Plan; userId: string | undefined; canAct: boolean; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const rowLabel = (rowId: string) => {
    const index = plan.members.findIndex((m) => m.id === rowId);
    const member = plan.members[index];
    return member ? `แถวที่ ${index + 1} (${member.sheetName} / ${member.excelRow})` : "ไม่พบแถวนี้แล้ว";
  };

  const isOwn = plan.proposedById !== null && plan.proposedById === userId;
  const blockedByFourEyes = IMPORT_MERGE_REQUIRES_SECOND_REVIEWER && isOwn;

  const run = async (path: "review" | "withdraw", body: unknown, done: string) => {
    setBusy(true);
    try {
      await api.post(`/api/import/merge-plans/${plan.id}/${path}`, body);
      toast.success(done);
      onDone();
    } catch (err) {
      toast.error(messageOf(err, "ดำเนินการไม่สำเร็จ"));
      onDone(); // the plan may have changed under us: reload what the server says
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card-surface p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="type-lead text-[var(--color-ink)]">{plan.nickname}</h2>
        <StatusChip tone={STATUS_TONE[plan.status]}>{IMPORT_MERGE_PLAN_STATUS_LABELS[plan.status]}</StatusChip>
      </header>
      <p className="type-caption text-[var(--color-body-muted)]">
        เสนอโดย {plan.proposedByName ?? "ผู้ใช้ที่ถูกลบ"} · {formatDateTime(plan.proposedAt)}
        {plan.note && <span className="block text-[var(--color-ink)]">{plan.note}</span>}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
          <caption className="sr-only">ผลลัพธ์ของแผนรวมสำหรับ {plan.nickname}</caption>
          <thead className="type-fine text-[var(--color-body-muted)]">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">ช่อง</th>
              <th scope="col" className="py-2 pr-3 font-medium">ค่าที่จะใช้</th>
              <th scope="col" className="py-2 font-medium">มาจาก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {IMPORT_MERGE_FIELDS.map((field) => (
              <tr key={field}>
                <th scope="row" className="py-2 pr-3 font-medium text-[var(--color-ink)]">{IMPORT_MERGE_FIELD_LABELS[field]}</th>
                <td className="py-2 pr-3 text-[var(--color-ink)]">{plan.result[field].value?.trim() || "—"}</td>
                <td className="py-2 text-[var(--color-body-muted)]">{rowLabel(plan.result[field].fromRowId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="type-caption mt-2 text-[var(--color-body-muted)]">แถวหลักที่จะเก็บไว้: {rowLabel(plan.primarySourceRowId)}</p>

      <details className="mt-3">
        <summary className="type-caption cursor-pointer text-[var(--color-body-muted)]">แถวทั้งหมดที่เปรียบเทียบ ({plan.members.length})</summary>
        <ul className="type-caption mt-2 flex flex-col gap-1 text-[var(--color-ink)]">
          {plan.members.map((m, index) => (
            <li key={m.id}>
              แถวที่ {index + 1} · {m.sourceFileName} · {m.sheetName} / {m.excelRow} · {m.rawFullName?.trim() || "—"} · อายุ {m.rawAge?.trim() || "—"} · {m.rawOccupation?.trim() || "—"} · {m.rawWorkplace?.trim() || "—"}
            </li>
          ))}
        </ul>
      </details>

      {plan.status === "approved" && (
        <p role="status" className="type-caption mt-3 text-[var(--color-ink)]">
          อนุมัติโดย {plan.reviewedByName ?? "ผู้ใช้ที่ถูกลบ"}{plan.reviewedAt ? ` · ${formatDateTime(plan.reviewedAt)}` : ""} — เป็นเพียงบันทึกความเห็นชอบ <strong>ยังไม่ได้รวมข้อมูลจริง</strong>
          {plan.reviewNote && <span className="block text-[var(--color-body-muted)]">{plan.reviewNote}</span>}
        </p>
      )}
      {(plan.status === "rejected" || plan.status === "withdrawn") && (
        <p className="type-caption mt-3 text-[var(--color-body-muted)]">
          {plan.status === "rejected" ? "ปฏิเสธ" : "ถอนแผน"}โดย {plan.reviewedByName ?? "ผู้ใช้ที่ถูกลบ"}{plan.reviewedAt ? ` · ${formatDateTime(plan.reviewedAt)}` : ""}
          {plan.reviewNote && <span className="block">{plan.reviewNote}</span>}
        </p>
      )}

      {plan.status === "proposed" && canAct && (
        <div className="mt-4 border-t border-[var(--color-hairline)] pt-4">
          {blockedByFourEyes ? (
            <div className="flex flex-col gap-3">
              <p className="type-caption text-[var(--color-body-muted)]">แผนนี้คุณเป็นผู้เสนอ ต้องให้ผู้ดูแลระบบอีกคนพิจารณา</p>
              <div>
                <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => void run("withdraw", {}, "ถอนแผนแล้ว")}>
                  ถอนแผน
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Field label="เหตุผล" hint={`จำเป็นเมื่อปฏิเสธ ไม่เกิน ${IMPORT_MERGE_NOTE_MAX} ตัวอักษร`}>
                {(props) => (
                  <textarea id={props.id} aria-describedby={props["aria-describedby"]} rows={2} maxLength={IMPORT_MERGE_NOTE_MAX} className={`${CONTROL_CLASS} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
                )}
              </Field>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => void run("review", { outcome: "approved", note: note.trim() || undefined }, "อนุมัติแผนรวมแล้ว")}>
                  อนุมัติ
                </button>
                <button type="button" className={SECONDARY_BUTTON} disabled={busy || note.trim() === ""} onClick={() => void run("review", { outcome: "rejected", note: note.trim() }, "ปฏิเสธแผนรวมแล้ว")}>
                  ปฏิเสธ
                </button>
              </div>
              <p className="type-fine text-[var(--color-body-muted)]">การอนุมัติไม่รวมข้อมูล ระบบเก็บเป็นบันทึกความเห็นชอบเท่านั้น</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function ImportMergeApprovals() {
  const { user } = useAuth();
  const canRead = hasRole(user?.role, PRIVILEGED_ROLES);
  const canAct = hasRole(user?.role, ADMIN_ROLES);

  const [status, setStatus] = useState<StatusFilter>("proposed");
  const [data, setData] = useState<PlansResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api
      .get<PlansResponse>(`/api/import/merge-plans?status=${status}`)
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(messageOf(err, "โหลดรายการแผนรวมไม่สำเร็จ")))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [canRead, status, reloadKey]);

  if (!canRead) {
    return (
      <AppLayout>
        <PageHeader title="อนุมัติแผนรวมข้อมูลซ้ำ" description="ตรวจและอนุมัติแผนรวมแถวที่เป็นคนเดียวกัน" />
        <EmptyState icon={Lock} title="ไม่มีสิทธิ์เข้าถึง" description="หน้านี้จำกัดเฉพาะผู้ดูแลระบบ เจ้าหน้าที่ และผู้นำพันธกิจ" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="อนุมัติแผนรวมข้อมูลซ้ำ"
        description="ผู้ดูแลระบบอีกคนตรวจแผนรวมที่เสนอไว้ แล้วอนุมัติหรือปฏิเสธ การอนุมัติยังไม่รวมข้อมูลจริง"
        secondaryActions={[{ label: "กลับไปหน้าตรวจสอบข้อมูลซ้ำ", href: "/import/duplicates" }]}
      />

      <ImportStepper />

      <section className="card-surface mb-4 p-4 sm:p-5">
        <Field label="สถานะแผน">
          {(props) => (
            <select id={props.id} aria-describedby={props["aria-describedby"]} className={CONTROL_CLASS} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">ทั้งหมด</option>
              {IMPORT_MERGE_PLAN_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {IMPORT_MERGE_PLAN_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          )}
        </Field>
        {IMPORT_MERGE_REQUIRES_SECOND_REVIEWER && (
          <p className="type-fine mt-3 text-[var(--color-body-muted)]">ผู้เสนอแผนอนุมัติแผนของตัวเองไม่ได้ ต้องมีผู้ดูแลระบบอย่างน้อย 2 คน</p>
        )}
      </section>

      {isLoading ? (
        <ListSkeleton count={2} />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : !data || data.plans.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="ไม่มีแผนรวมตามสถานะที่เลือก" description="เสนอแผนรวมได้จากหน้าตรวจสอบข้อมูลซ้ำ หลังบันทึกผลว่า “คนเดียวกัน”" />
      ) : (
        <div className="flex flex-col gap-4">
          {data.plans.map((plan) => (
            <PlanCard key={`${plan.id}-${plan.status}`} plan={plan} userId={user?.id} canAct={canAct} onDone={reload} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
