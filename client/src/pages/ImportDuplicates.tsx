import { useEffect, useMemo, useState } from "react";
import { Copy, Lock } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, ErrorState, Field, PageHeader, StatusChip } from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ADMIN_ROLES, PRIVILEGED_ROLES, hasRole } from "@shared/roles";
import {
  IMPORT_DUPLICATE_DECISIONS,
  IMPORT_DUPLICATE_DECISION_LABELS,
  IMPORT_DUPLICATE_NOTE_MAX,
  type ImportDuplicateDecision,
} from "@shared/importDecisions";
import {
  IMPORT_MERGE_FIELDS,
  IMPORT_MERGE_FIELD_LABELS,
  IMPORT_MERGE_NOTE_MAX,
  IMPORT_MERGE_PLAN_STATUS_LABELS,
  type ImportMergeField,
  type ImportMergePlanStatus,
} from "@shared/importMerge";
import { decisionPanelKey, defaultMergePlanForm, mergePlanPanelKey } from "./importDuplicatesKeys";

/**
 * Admin → ตรวจสอบข้อมูลซ้ำ (§17). Shows every row that shares a normalized
 * nickname, side by side with the verbatim Excel values.
 *
 * A review aid (§8): the system flags candidates and shows evidence; it never
 * merges rows and never decides that two rows are one person. An admin can
 * RECORD a judgement ("same person" / "different people"). That is an
 * append-only log: nothing is merged, edited or promoted into members (L3).
 */

interface BatchOption {
  id: string;
  sourceFileName: string;
}

interface Member {
  sourceRowId: string;
  batchId: string;
  sourceFileName: string;
  sheetName: string;
  excelRow: number;
  team: string | null;
  rawFullName: string | null;
  rawAge: string | null;
  age: number | null;
  rawOccupation: string | null;
  rawWorkplace: string | null;
}

interface DecisionEntry {
  id: string;
  decision: ImportDuplicateDecision;
  note: string | null;
  decidedAt: string;
  decidedByName: string | null;
  /** False once a later import changed the group's rows after this decision. */
  matchesCurrentRows: boolean;
}

interface Candidate {
  nickname: string;
  occurrences: number;
  members: Member[];
  /** Newest first. */
  decisions: DecisionEntry[];
  /** The newest merge plan for exactly these rows, any status. */
  mergePlan: { id: string; status: ImportMergePlanStatus } | null;
}

type StatusFilter = "all" | "undecided" | "decided";

/** The decision that still applies to the group's current rows, if any. */
const currentDecision = (candidate: Candidate) => candidate.decisions.find((d) => d.matchesCurrentRows) ?? null;
/** A decision was recorded, but the group has changed since. */
const hasStaleDecision = (candidate: Candidate) => candidate.decisions.length > 0 && currentDecision(candidate) === null;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface DuplicatesResponse {
  duplicates: Candidate[];
  note: string;
}

const CONTROL_CLASS =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

const messageOf = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

type FieldRow = { label: string; values: string[] };

/** Rows of the comparison table: one row per field, one value per occurrence. */
function buildFieldRows(members: Member[]): FieldRow[] {
  const text = (value: string | null) => (value ?? "").trim();
  return [
    { label: "ชื่อ-สกุล", values: members.map((m) => text(m.rawFullName)) },
    { label: "อายุ (ดิบ)", values: members.map((m) => text(m.rawAge)) },
    { label: "อาชีพ", values: members.map((m) => text(m.rawOccupation)) },
    { label: "สถานที่ทำงาน", values: members.map((m) => text(m.rawWorkplace)) },
  ];
}

const differs = (values: string[]) => new Set(values).size > 1;

function DecisionPanel({ candidate, canDecide, onSaved }: { candidate: Candidate; canDecide: boolean; onSaved: () => void }) {
  const current = currentDecision(candidate);
  const [choice, setChoice] = useState<ImportDuplicateDecision | "">(current?.decision ?? "");
  const [note, setNote] = useState(current?.note ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (choice === "") return;
    setIsSaving(true);
    try {
      await api.post("/api/import/duplicates/decisions", {
        nickname: candidate.nickname,
        sourceRowIds: candidate.members.map((m) => m.sourceRowId),
        decision: choice,
        note: note.trim() === "" ? undefined : note.trim(),
      });
      toast.success("บันทึกการตัดสินใจแล้ว");
      onSaved();
    } catch (err) {
      toast.error(messageOf(err, "บันทึกการตัดสินใจไม่สำเร็จ"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-[var(--color-hairline)] pt-4">
      {hasStaleDecision(candidate) && (
        <p role="status" className="type-caption mb-3 text-[var(--color-warning)]">
          มีการนำเข้าใหม่ที่เปลี่ยนแถวในกลุ่มนี้หลังการตัดสินใจครั้งก่อน กรุณาตรวจและตัดสินใหม่
        </p>
      )}
      {canDecide && (
        <fieldset className="flex flex-col gap-3">
          <legend className="type-caption mb-2 font-medium text-[var(--color-ink)]">ผลการตรวจสอบของคุณ</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {IMPORT_DUPLICATE_DECISIONS.map((value) => (
              <label
                key={value}
                className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] px-3 text-sm text-[var(--color-ink)] has-[:checked]:border-[var(--color-primary)] has-[:checked]:bg-[var(--color-canvas-soft)]"
              >
                <input
                  type="radio"
                  name={`decision-${candidate.nickname}`}
                  value={value}
                  checked={choice === value}
                  onChange={() => setChoice(value)}
                />
                {IMPORT_DUPLICATE_DECISION_LABELS[value]}
              </label>
            ))}
          </div>
          <Field label="เหตุผล (ไม่บังคับ)" hint={`ไม่เกิน ${IMPORT_DUPLICATE_NOTE_MAX} ตัวอักษร`}>
            {(props) => (
              <textarea
                id={props.id}
                aria-describedby={props["aria-describedby"]}
                rows={2}
                maxLength={IMPORT_DUPLICATE_NOTE_MAX}
                className={`${CONTROL_CLASS} py-2`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          <div>
            <button
              type="button"
              disabled={choice === "" || isSaving}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
            >
              {isSaving ? "กำลังบันทึก…" : "บันทึกการตัดสินใจ"}
            </button>
            <p className="type-fine mt-2 text-[var(--color-body-muted)]">การบันทึกไม่รวมหรือแก้ข้อมูลใด ๆ ระบบเก็บเป็นประวัติเท่านั้น</p>
          </div>
        </fieldset>
      )}
      {candidate.decisions.length > 0 && (
        <details className="mt-3">
          <summary className="type-caption cursor-pointer text-[var(--color-body-muted)]">
            ประวัติการตัดสินใจ ({candidate.decisions.length})
          </summary>
          <ul className="type-caption mt-2 flex flex-col gap-2">
            {candidate.decisions.map((d) => (
              <li key={d.id} className="text-[var(--color-ink)]">
                <span className="font-semibold">{IMPORT_DUPLICATE_DECISION_LABELS[d.decision]}</span>
                {" · "}
                {d.decidedByName ?? "ผู้ใช้ที่ถูกลบ"} · {formatDateTime(d.decidedAt)}
                {!d.matchesCurrentRows && <span className="text-[var(--color-warning)]"> · ใช้กับแถวชุดเดิม</span>}
                {d.note && <span className="block text-[var(--color-body-muted)]">{d.note}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Proposes a merge PLAN for a group judged "same person": which row survives
 * and where each field value comes from. A second admin approves it on the
 * approvals page. Nothing is merged: this only records the plan.
 */
function MergePlanPanel({ candidate, canDecide, onSaved }: { candidate: Candidate; canDecide: boolean; onSaved: () => void }) {
  // The panel is remounted (see mergePlanPanelKey) whenever the compared rows
  // change, so this initial state always refers to the rows on screen.
  const [initial] = useState(() => defaultMergePlanForm(candidate.members));
  const [primary, setPrimary] = useState(initial.primary);
  const [choices, setChoices] = useState<Record<ImportMergeField, string>>(initial.choices);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const plan = candidate.mergePlan;
  const decidedSame = currentDecision(candidate)?.decision === "same_person";

  if (plan?.status === "proposed" || plan?.status === "approved") {
    return (
      <div className="mt-4 border-t border-[var(--color-hairline)] pt-4">
        <p className="type-caption text-[var(--color-ink)]">
          <StatusChip tone={plan.status === "approved" ? "success" : "info"}>แผนรวม: {IMPORT_MERGE_PLAN_STATUS_LABELS[plan.status]}</StatusChip>{" "}
          <Link href="/import/merge-approvals" className="underline">
            ไปหน้าอนุมัติแผนรวม
          </Link>
          {plan.status === "approved" && <span className="text-[var(--color-body-muted)]"> · ยังไม่ได้รวมข้อมูลจริง</span>}
        </p>
      </div>
    );
  }
  if (!canDecide || !decidedSame) return null;

  const labelOf = (rowId: string) => `แถวที่ ${candidate.members.findIndex((m) => m.sourceRowId === rowId) + 1}`;
  const valueOf = (member: Member, field: ImportMergeField) =>
    ({ fullName: member.rawFullName, age: member.rawAge, occupation: member.rawOccupation, workplace: member.rawWorkplace })[field]?.trim() || "—";

  const save = async () => {
    setIsSaving(true);
    try {
      await api.post("/api/import/merge-plans", {
        nickname: candidate.nickname,
        sourceRowIds: candidate.members.map((m) => m.sourceRowId),
        primarySourceRowId: primary,
        fieldChoices: choices,
        note: note.trim() === "" ? undefined : note.trim(),
      });
      toast.success("เสนอแผนรวมแล้ว รอผู้ดูแลระบบอีกคนอนุมัติ");
      onSaved();
    } catch (err) {
      toast.error(messageOf(err, "เสนอแผนรวมไม่สำเร็จ"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <details className="mt-4 border-t border-[var(--color-hairline)] pt-4">
      <summary className="type-caption cursor-pointer font-medium text-[var(--color-ink)]">
        เสนอแผนรวมข้อมูล{plan?.status === "rejected" ? " (แผนก่อนหน้าถูกปฏิเสธ)" : ""}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="แถวหลักที่จะเก็บไว้">
          {(props) => (
            <select id={props.id} aria-describedby={props["aria-describedby"]} className={CONTROL_CLASS} value={primary} onChange={(e) => setPrimary(e.target.value)}>
              {candidate.members.map((m, index) => (
                <option key={m.sourceRowId} value={m.sourceRowId}>
                  แถวที่ {index + 1} ({m.sheetName} / {m.excelRow})
                </option>
              ))}
            </select>
          )}
        </Field>
        {IMPORT_MERGE_FIELDS.map((field) => (
          <Field key={field} label={`${IMPORT_MERGE_FIELD_LABELS[field]} ใช้ค่าจาก`}>
            {(props) => (
              <select
                id={props.id}
                aria-describedby={props["aria-describedby"]}
                className={CONTROL_CLASS}
                value={choices[field]}
                onChange={(e) => setChoices((prev) => ({ ...prev, [field]: e.target.value }))}
              >
                {candidate.members.map((m) => (
                  <option key={m.sourceRowId} value={m.sourceRowId}>
                    {labelOf(m.sourceRowId)}: {valueOf(m, field)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ))}
        <Field label="เหตุผล (ไม่บังคับ)" hint={`ไม่เกิน ${IMPORT_MERGE_NOTE_MAX} ตัวอักษร`}>
          {(props) => (
            <textarea id={props.id} aria-describedby={props["aria-describedby"]} rows={2} maxLength={IMPORT_MERGE_NOTE_MAX} className={`${CONTROL_CLASS} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </Field>
        <div>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void save()}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50"
          >
            {isSaving ? "กำลังส่ง…" : "ส่งแผนรวมเพื่อขออนุมัติ"}
          </button>
          <p className="type-fine mt-2 text-[var(--color-body-muted)]">ผู้ดูแลระบบอีกคนต้องอนุมัติ และระบบยังไม่รวมข้อมูลจริง</p>
        </div>
      </div>
    </details>
  );
}

function CandidateCard({ candidate, canDecide, onSaved }: { candidate: Candidate; canDecide: boolean; onSaved: () => void }) {
  const fieldRows = useMemo(() => buildFieldRows(candidate.members), [candidate.members]);
  const differing = fieldRows.filter((row) => differs(row.values)).length;
  const sources = new Set(candidate.members.map((m) => `${m.batchId}/${m.sheetName}`)).size;

  return (
    <article className="card-surface p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="type-lead text-[var(--color-ink)]">{candidate.nickname}</h2>
        <StatusChip tone="info">{candidate.occurrences} แถว</StatusChip>
        <StatusChip tone={differing === 0 ? "warning" : "neutral"}>
          {differing === 0 ? "ข้อมูลเหมือนกันทุกช่อง" : `ต่างกัน ${differing} ช่อง`}
        </StatusChip>
        {sources > 1 && <StatusChip>อยู่ใน {sources} ชีต/ไฟล์</StatusChip>}
        {(() => {
          const current = currentDecision(candidate);
          if (current) return <StatusChip tone="success">ตัดสินแล้ว: {IMPORT_DUPLICATE_DECISION_LABELS[current.decision]}</StatusChip>;
          if (hasStaleDecision(candidate)) return <StatusChip tone="warning">ต้องตรวจใหม่</StatusChip>;
          return <StatusChip>ยังไม่ตัดสิน</StatusChip>;
        })()}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <caption className="sr-only">เปรียบเทียบแถวที่ใช้ชื่อเล่น {candidate.nickname}</caption>
          <thead className="type-fine text-[var(--color-body-muted)]">
            <tr>
              <th scope="col" className="py-2 pr-3 font-medium">
                ช่อง
              </th>
              {candidate.members.map((m, index) => (
                <th key={`${m.batchId}-${m.sheetName}-${m.excelRow}`} scope="col" className="py-2 pr-3 font-medium">
                  <span className="block text-[var(--color-ink)]">แถวที่ {index + 1}</span>
                  <span className="block font-normal">
                    {m.sheetName} / {m.excelRow}
                  </span>
                  <span className="block max-w-[10rem] truncate font-normal" title={m.sourceFileName}>
                    {m.sourceFileName}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {fieldRows.map((row) => {
              const isDifferent = differs(row.values);
              return (
                <tr key={row.label}>
                  <th scope="row" className="py-2 pr-3 align-top font-medium text-[var(--color-ink)]">
                    {row.label}
                    {isDifferent && <span className="type-fine ml-2 text-[var(--color-warning)]">ต่างกัน</span>}
                  </th>
                  {row.values.map((value, index) => (
                    <td
                      key={index}
                      className={`py-2 pr-3 align-top ${isDifferent ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-body-muted)]"}`}
                    >
                      {value === "" ? "—" : value}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <DecisionPanel key={decisionPanelKey(candidate)} candidate={candidate} canDecide={canDecide} onSaved={onSaved} />
      <MergePlanPanel key={mergePlanPanelKey(candidate)} candidate={candidate} canDecide={canDecide} onSaved={onSaved} />
    </article>
  );
}

export default function ImportDuplicates() {
  const { user } = useAuth();
  const canRead = hasRole(user?.role, PRIVILEGED_ROLES);
  const canDecide = hasRole(user?.role, ADMIN_ROLES);

  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchId, setBatchId] = useState("");
  const [data, setData] = useState<DuplicatesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    if (!canRead) return;
    api
      .get<BatchOption[]>("/api/import/batches?limit=50")
      .then(setBatches)
      .catch(() => setBatches([])); // the filter is optional; the list still loads
  }, [canRead]);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const query = new URLSearchParams({ limit: "100" });
    if (batchId) query.set("batchId", batchId);
    api
      .get<DuplicatesResponse>(`/api/import/duplicates?${query.toString()}`)
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(messageOf(err, "โหลดรายการข้อมูลซ้ำไม่สำเร็จ")))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [canRead, batchId, reloadKey]);

  const decidedCount = data ? data.duplicates.filter((c) => currentDecision(c) !== null).length : 0;
  const visible = useMemo(() => {
    const all = data?.duplicates ?? [];
    if (statusFilter === "decided") return all.filter((c) => currentDecision(c) !== null);
    if (statusFilter === "undecided") return all.filter((c) => currentDecision(c) === null);
    return all;
  }, [data, statusFilter]);

  if (!canRead) {
    return (
      <AppLayout>
        <PageHeader title="ตรวจสอบข้อมูลซ้ำ" description="เปรียบเทียบแถวที่ใช้ชื่อเล่นเดียวกันจากไฟล์ที่นำเข้า" />
        <EmptyState icon={Lock} title="ไม่มีสิทธิ์เข้าถึง" description="หน้านี้จำกัดเฉพาะผู้ดูแลระบบ เจ้าหน้าที่ และผู้นำพันธกิจ" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="ตรวจสอบข้อมูลซ้ำ"
        description="แสดงแถวที่ใช้ชื่อเล่นเดียวกัน เรียงข้างกันเพื่อให้คนตัดสินเอง ผู้ดูแลระบบบันทึกผลได้ ระบบไม่รวมข้อมูลให้อัตโนมัติ"
        secondaryActions={[
          { label: "อนุมัติแผนรวม", href: "/import/merge-approvals" },
          { label: "กลับไปหน้านำเข้าข้อมูล", href: "/import" },
        ]}
      />

      <section className="card-surface mb-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="สถานะการตัดสินใจ" hint="กรองตามผลที่บันทึกไว้">
          {(props) => (
            <select
              id={props.id}
              aria-describedby={props["aria-describedby"]}
              className={CONTROL_CLASS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">ทั้งหมด</option>
              <option value="undecided">ยังไม่ตัดสิน / ต้องตรวจใหม่</option>
              <option value="decided">ตัดสินแล้ว</option>
            </select>
          )}
        </Field>
        <Field label="ไฟล์ที่นำเข้า" hint="เว้นว่างไว้เพื่อดูทุกไฟล์รวมกัน">
          {(props) => (
            <select
              id={props.id}
              aria-describedby={props["aria-describedby"]}
              className={CONTROL_CLASS}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">ทุกไฟล์</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.sourceFileName}
                </option>
              ))}
            </select>
          )}
        </Field>
        </div>
      </section>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : error ? (
        <ErrorState description={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !data || visible.length === 0 ? (
        <EmptyState
          icon={Copy}
          title={data && data.duplicates.length > 0 ? "ไม่มีรายการตามสถานะที่เลือก" : "ไม่พบชื่อเล่นซ้ำ"}
          description={
            data && data.duplicates.length > 0
              ? "เปลี่ยนตัวกรองสถานะเพื่อดูรายการอื่น"
              : "ยังไม่มีแถวที่ใช้ชื่อเล่นเดียวกันในไฟล์ที่เลือก"
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="type-caption text-[var(--color-body-muted)]">
            พบ {data.duplicates.length} ชื่อเล่นที่ซ้ำ (ตัดสินแล้ว {decidedCount}) ชื่อเล่นเดียวกันอาจเป็นคนละคน ตรวจช่องที่ทำเครื่องหมาย "ต่างกัน" ก่อนตัดสิน
          </p>
          {visible.map((candidate) => (
            <CandidateCard key={candidate.nickname} candidate={candidate} canDecide={canDecide} onSaved={() => setReloadKey((k) => k + 1)} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
