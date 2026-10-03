import { useCallback, useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Lock, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, ErrorState, Modal, PageHeader, SectionHeader, StatusChip, type StatusTone } from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { ADMIN_ROLES, PRIVILEGED_ROLES, hasRole } from "@shared/roles";
import { IMPORT_BLOB_PREFIX, IMPORT_UPLOAD_FILENAME_HEADER, IMPORT_UPLOAD_MAX_BYTES } from "@shared/importUpload";

/**
 * Admin → นำเข้าข้อมูล (§17). Upload → parse → preview → report.
 * It only reads and writes the L1 (raw) and L2 (normalized) layers. Nothing
 * here promotes data into members or groups (L3).
 */

/** Vercel rejects function requests above 4.5 MB; stay below it for the direct path. */
const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

interface BatchRow {
  id: string;
  sourceFileName: string;
  worksheetCount: number;
  rowCount: number;
  memberCount: number;
  quarantinedCount: number;
  createdAt: string;
}

interface PreviewRow {
  id: string;
  sheetName: string;
  excelRow: number;
  rawFullName: string | null;
  rawNickname: string | null;
  rawAge: string | null;
  normStatus: string;
  normIssue: string | null;
  norm: { age: number | null } | null;
}

interface BatchReport {
  batch: BatchRow;
  counts: { memberRows: number; normalized: number; quarantined: number; skipped: number; flaggedDuplicates: number };
  quarantinedIssues: Array<{ issue: string; rows: number }>;
  blockedFields: Array<{ key: string; note: string }>;
}

interface PreCheckResult {
  gate: { migrationBlocked: boolean; verdict: string; verdictThai: string };
  report: unknown;
  note?: string;
}

const CONTROL_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const messageOf = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

export default function ImportData() {
  const { user } = useAuth();
  const canRead = hasRole(user?.role, PRIVILEGED_ROLES);
  const canImport = hasRole(user?.role, ADMIN_ROLES);

  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<{ name: string; percent: number } | null>(null);
  const [preCheck, setPreCheck] = useState<PreCheckResult | null>(null);
  const [isCheckingGate, setIsCheckingGate] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadBatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setBatches(await api.get<BatchRow[]>("/api/import/batches?limit=50"));
    } catch (err) {
      setError(messageOf(err, "โหลดรายการนำเข้าไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) void loadBatches();
  }, [canRead, loadBatches]);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("รองรับเฉพาะไฟล์ .xlsx");
      return;
    }
    if (file.size > IMPORT_UPLOAD_MAX_BYTES) {
      toast.error(`ไฟล์ใหญ่เกิน ${formatSize(IMPORT_UPLOAD_MAX_BYTES)}`);
      return;
    }
    setUploadState({ name: file.name, percent: 0 });
    try {
      let result: { batch: BatchRow; counts: BatchReport["counts"] };
      if (file.size <= DIRECT_UPLOAD_MAX_BYTES) {
        setUploadState({ name: file.name, percent: 100 });
        result = await postRaw(file);
      } else {
        const { upload } = await import("@vercel/blob/client");
        const blob = await upload(`${IMPORT_BLOB_PREFIX}${Date.now()}.xlsx`, file, {
          access: "private",
          handleUploadUrl: "/api/import/upload/token",
          multipart: true,
          onUploadProgress: ({ percentage }) => setUploadState({ name: file.name, percent: Math.round(percentage) }),
        });
        setUploadState({ name: file.name, percent: 100 });
        result = await api.post("/api/import/upload/from-blob", { pathname: blob.pathname, fileName: file.name });
      }
      toast.success(`นำเข้าแล้ว ${result.counts.memberRows} แถว (ตรวจพบปัญหา ${result.counts.quarantined} แถว)`);
      await loadBatches();
      setSelectedId(result.batch.id);
    } catch (err) {
      toast.error(messageOf(err, err instanceof Error ? err.message : "นำเข้าไฟล์ไม่สำเร็จ"));
    } finally {
      setUploadState(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const runPreCheck = async () => {
    setIsCheckingGate(true);
    try {
      setPreCheck(await api.get<PreCheckResult>("/api/import/precheck/group-members"));
    } catch (err) {
      toast.error(messageOf(err, "ตรวจสอบไม่สำเร็จ"));
    } finally {
      setIsCheckingGate(false);
    }
  };

  if (!canRead) {
    return (
      <AppLayout>
        <PageHeader title="นำเข้าจาก Excel" description="นำเข้าทะเบียนพันธกิจจากไฟล์ Excel (ตรวจสอบก่อน ยังไม่เข้าทะเบียนสมาชิก)" />
        <EmptyState icon={Lock} title="ไม่มีสิทธิ์เข้าถึง" description="หน้านี้จำกัดเฉพาะผู้ดูแลระบบ เจ้าหน้าที่ และผู้นำพันธกิจ" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="นำเข้าจาก Excel"
        description="อัปโหลดทะเบียนพันธกิจ (.xlsx) เพื่อตรวจสอบก่อน ข้อมูลยังไม่ถูกส่งเข้าทะเบียนสมาชิกหรือกลุ่ม"
        secondaryActions={[
          { label: "ตรวจสอบข้อมูลซ้ำ", href: "/import/duplicates" },
          { label: "โหลดข้อมูลผังองค์กร", href: "/import/org" },
          { label: "รีเฟรช", icon: RefreshCw, onClick: () => void loadBatches() },
        ]}
      />

      {canImport && (
        <section className="card-surface mb-4 p-4 sm:p-5">
          <SectionHeader title="อัปโหลดไฟล์" description={`ไฟล์ .xlsx ไม่เกิน ${formatSize(IMPORT_UPLOAD_MAX_BYTES)} ไฟล์เดิมจะไม่ถูกนำเข้าซ้ำ`} />
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="เลือกไฟล์ Excel"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button type="button" className={PRIMARY_BUTTON} disabled={uploadState !== null} onClick={() => fileInput.current?.click()}>
            <Upload size={ICON_SIZE.sm} aria-hidden="true" />
            {uploadState ? "กำลังนำเข้า…" : "เลือกไฟล์ Excel"}
          </button>
          {uploadState && (
            <div className="mt-4" role="status" aria-live="polite">
              <p className="type-caption text-[var(--color-body-muted)]">
                {uploadState.name} — {uploadState.percent < 100 ? `อัปโหลด ${uploadState.percent}%` : "กำลังอ่านและตรวจสอบไฟล์ อาจใช้เวลาสักครู่"}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-canvas-soft)]">
                <div className="h-full bg-[var(--color-primary)] transition-[width]" style={{ width: `${uploadState.percent}%` }} />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card-surface mb-4 p-4 sm:p-5">
        <SectionHeader title="ชุดข้อมูลที่นำเข้าแล้ว" />
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : error ? (
          <ErrorState inset description={error} onRetry={() => void loadBatches()} />
        ) : batches.length === 0 ? (
          <EmptyState inset icon={FileSpreadsheet} title="ยังไม่มีการนำเข้า" description={canImport ? "เลือกไฟล์ Excel ด้านบนเพื่อเริ่ม" : "ผู้ดูแลระบบยังไม่ได้นำเข้าไฟล์"} />
        ) : (
          <ul className="divide-y divide-[var(--color-hairline)]">
            {batches.map((batch) => (
              <li key={batch.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--color-ink)]">{batch.sourceFileName}</p>
                  <p className="type-caption text-[var(--color-body-muted)]">
                    {formatDateTime(batch.createdAt)} · {batch.worksheetCount} ชีต · {batch.memberCount} แถวสมาชิก
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip tone={batch.quarantinedCount > 0 ? "warning" : "success"}>
                    {batch.quarantinedCount > 0 ? `ต้องตรวจ ${batch.quarantinedCount} แถว` : "ไม่พบปัญหา"}
                  </StatusChip>
                  <button type="button" className={CONTROL_BUTTON} onClick={() => setSelectedId(batch.id)}>
                    ดูรายละเอียด
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canImport && (
        <section className="card-surface mb-4 p-4 sm:p-5">
          <SectionHeader
            title="ตรวจสอบก่อนแก้โครงสร้างกลุ่ม"
            description="อ่านอย่างเดียว ตรวจสมาชิกกลุ่มที่ซ้ำก่อนอนุญาตให้ปรับตารางสมาชิกกลุ่ม"
          />
          <button type="button" className={CONTROL_BUTTON} disabled={isCheckingGate} onClick={() => void runPreCheck()}>
            <ShieldCheck size={ICON_SIZE.sm} aria-hidden="true" />
            {isCheckingGate ? "กำลังตรวจ…" : "ตรวจสอบ group_members"}
          </button>
          {preCheck && (
            <div className="mt-4" role="status">
              <StatusChip tone={preCheck.gate.migrationBlocked ? "error" : "success"}>
                {preCheck.gate.verdict} — {preCheck.gate.verdictThai}
              </StatusChip>
              <pre className="mt-3 max-h-80 overflow-auto rounded-[var(--radius-sm)] bg-[var(--color-canvas-soft)] p-3 text-xs">
                {JSON.stringify(preCheck.report, null, 2)}
              </pre>
            </div>
          )}
        </section>
      )}

      {selectedId && <BatchDetail batchId={selectedId} onClose={() => setSelectedId(null)} />}
    </AppLayout>
  );
}

async function postRaw(file: File): Promise<{ batch: BatchRow; counts: BatchReport["counts"] }> {
  const res = await fetch("/api/import/upload", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/octet-stream",
      [IMPORT_UPLOAD_FILENAME_HEADER]: encodeURIComponent(file.name),
    },
    body: file,
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: { batch: BatchRow; counts: BatchReport["counts"] }; error?: { message?: string } } | null;
  if (!res.ok || !body?.success || !body.data) {
    throw new Error(body?.error?.message ?? "นำเข้าไฟล์ไม่สำเร็จ");
  }
  return body.data;
}

const ISSUE_LABELS: Record<string, string> = {
  AGE_NOT_NUMERIC: "อายุไม่ใช่ตัวเลข",
};

function BatchDetail({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const [report, setReport] = useState<BatchReport | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([
      api.get<BatchReport>(`/api/import/batches/${batchId}/report`),
      api.get<{ rows: PreviewRow[] }>(`/api/import/batches/${batchId}/preview?limit=100&status=${onlyIssues ? "quarantined" : "all"}`),
    ])
      .then(([r, p]) => {
        if (cancelled) return;
        setReport(r);
        setRows(p.rows);
      })
      .catch((err) => !cancelled && setError(messageOf(err, "โหลดรายละเอียดไม่สำเร็จ")))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [batchId, onlyIssues]);

  const tone = (status: string): StatusTone => (status === "ok" ? "success" : "warning");

  return (
    <Modal open onClose={onClose} size="wide" title={report?.batch.sourceFileName ?? "รายละเอียดชุดข้อมูล"}>
      {isLoading && !report ? (
        <ListSkeleton count={3} />
      ) : error ? (
        <ErrorState inset description={error} />
      ) : (
        report && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["แถวสมาชิก", report.counts.memberRows],
                ["ผ่านการปรับรูปแบบ", report.counts.normalized],
                ["ต้องตรวจ", report.counts.quarantined],
                ["ชื่อที่อาจซ้ำ", report.counts.flaggedDuplicates],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-[var(--radius-sm)] bg-[var(--color-canvas-soft)] p-3">
                  <dt className="type-fine text-[var(--color-body-muted)]">{label}</dt>
                  <dd className="type-lead text-[var(--color-ink)]">{value}</dd>
                </div>
              ))}
            </dl>
            {report.quarantinedIssues.length > 0 && (
              <ul className="type-caption list-disc pl-5 text-[var(--color-ink)]">
                {report.quarantinedIssues.map((i) => (
                  <li key={i.issue}>
                    {ISSUE_LABELS[i.issue] ?? i.issue}: {i.rows} แถว
                  </li>
                ))}
              </ul>
            )}
            <p className="type-caption text-[var(--color-body-muted)]">
              ช่องที่ยังไม่ยืนยันความหมาย ({report.blockedFields.map((f) => f.key).join(", ")}) เก็บเป็นค่าดิบเท่านั้น และยังไม่ถูกส่งเข้าทะเบียนสมาชิก
            </p>
            <label className="type-caption flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
              แสดงเฉพาะแถวที่ต้องตรวจ
            </label>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="type-fine text-[var(--color-body-muted)]">
                  <tr>
                    <th className="py-2 pr-3">ชีต / แถว</th>
                    <th className="py-2 pr-3">ชื่อ</th>
                    <th className="py-2 pr-3">ชื่อเล่น</th>
                    <th className="py-2 pr-3">อายุ (ดิบ → ปรับแล้ว)</th>
                    <th className="py-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-hairline)]">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-3">
                        {row.sheetName} / {row.excelRow}
                      </td>
                      <td className="py-2 pr-3">{row.rawFullName || "—"}</td>
                      <td className="py-2 pr-3">{row.rawNickname || "—"}</td>
                      <td className="py-2 pr-3">
                        {row.rawAge || "—"} → {row.norm?.age ?? "—"}
                      </td>
                      <td className="py-2">
                        <StatusChip tone={tone(row.normStatus)}>
                          {row.normStatus === "ok" ? "ปกติ" : (ISSUE_LABELS[row.normIssue ?? ""] ?? "ต้องตรวจ")}
                        </StatusChip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="type-fine text-[var(--color-body-muted)]">แสดงสูงสุด 100 แถวแรก</p>
          </div>
        )
      )}
    </Modal>
  );
}
