import { useEffect, useMemo, useState } from "react";
import { Copy, Lock } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, ErrorState, Field, PageHeader, StatusChip } from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { PRIVILEGED_ROLES, hasRole } from "@shared/roles";

/**
 * Admin → ตรวจสอบข้อมูลซ้ำ (§17). Shows every row that shares a normalized
 * nickname, side by side with the verbatim Excel values.
 *
 * It is a READ-ONLY review aid (§8): the system flags candidates and shows
 * evidence; it never merges rows and never decides that two rows are one
 * person. Promotion into members (L3) is a later, human-confirmed phase.
 */

interface BatchOption {
  id: string;
  sourceFileName: string;
}

interface Member {
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

interface Candidate {
  nickname: string;
  occurrences: number;
  members: Member[];
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

function CandidateCard({ candidate }: { candidate: Candidate }) {
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
    </article>
  );
}

export default function ImportDuplicates() {
  const { user } = useAuth();
  const canRead = hasRole(user?.role, PRIVILEGED_ROLES);

  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [batchId, setBatchId] = useState("");
  const [data, setData] = useState<DuplicatesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
        description="แสดงแถวที่ใช้ชื่อเล่นเดียวกัน เรียงข้างกันเพื่อให้คนตัดสินเอง ระบบไม่รวมข้อมูลให้อัตโนมัติ"
        secondaryActions={[{ label: "กลับไปหน้านำเข้าข้อมูล", href: "/import" }]}
      />

      <section className="card-surface mb-4 p-4 sm:p-5">
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
      </section>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : error ? (
        <ErrorState description={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !data || data.duplicates.length === 0 ? (
        <EmptyState
          icon={Copy}
          title="ไม่พบชื่อเล่นซ้ำ"
          description="ยังไม่มีแถวที่ใช้ชื่อเล่นเดียวกันในไฟล์ที่เลือก"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="type-caption text-[var(--color-body-muted)]">
            พบ {data.duplicates.length} ชื่อเล่นที่ซ้ำ ชื่อเล่นเดียวกันอาจเป็นคนละคน ตรวจช่องที่ทำเครื่องหมาย "ต่างกัน" ก่อนตัดสิน
          </p>
          {data.duplicates.map((candidate) => (
            <CandidateCard key={candidate.nickname} candidate={candidate} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
