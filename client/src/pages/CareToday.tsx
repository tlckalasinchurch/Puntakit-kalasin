import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ListChecks, MessageCircle, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState, ErrorState, PageHeader } from "@/components/DesignSystem";
import { ListSkeleton } from "@/components/LoadingStates";
import { api, ApiError } from "@/lib/api";

/**
 * เช็คชื่อพันธกิจ — the care leader's weekly job on one screen.
 *
 *   home    : who should be called (missed 2+ meetings in a row) + one big button
 *   checkin : tap the names of the people who came, then save
 *
 * Data: GET /api/care/groups (which care groups the caller may use), GET
 * /api/care/groups/:id/roster (members, today's marks, consecutive misses) and
 * POST /api/attendance/bulk (save). Clay surfaces come from `.clay-*` in
 * index.css; nothing here is invented: an empty list says it is empty.
 */

interface CareOption {
  id: string;
  name: string;
}
interface BodyOption {
  name: string;
  careGroups: CareOption[];
}
interface RosterMember {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  lineId: string | null;
  status: "present" | "absent" | "leave" | "online" | null;
  missed: number;
  lastSeen: string | null;
}
interface Roster {
  group: { id: string; name: string; bodyName: string | null; careLeaderName: string | null };
  date: string;
  sessions: string[];
  members: RosterMember[];
}

const STORE_KEY = "puntakit.careGroup";
const FOLLOW_UP_AFTER = 2; // consecutive missed meetings before someone is listed to call

/** Today as YYYY-MM-DD in the viewer's time zone (the server stores calendar days). */
function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const isPresent = (s: RosterMember["status"]) => s === "present" || s === "online";
const label = (m: RosterMember) => m.nickname?.trim() || m.name;
const errText = (e: unknown) => (e instanceof ApiError ? (e.serverMessage ?? e.message) : String(e));

function readStored(): string {
  try {
    return localStorage.getItem(STORE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function CareToday() {
  const [bodies, setBodies] = useState<BodyOption[] | null>(null);
  const [bodiesError, setBodiesError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>(() => new URLSearchParams(window.location.search).get("group") ?? readStored());
  const [roster, setRoster] = useState<Roster | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [mode, setMode] = useState<"home" | "checkin">("home");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const date = useMemo(localDate, []);

  useEffect(() => {
    api
      .get<{ bodies: BodyOption[] }>("/api/care/groups")
      .then((o) => {
        setBodies(o.bodies);
        const all = o.bodies.flatMap((b) => b.careGroups);
        setGroupId((cur) => (all.some((c) => c.id === cur) ? cur : (all[0]?.id ?? "")));
      })
      .catch((e) => setBodiesError(errText(e)));
  }, []);

  const loadRoster = useCallback(async () => {
    if (!groupId) return;
    setRosterError(null);
    try {
      setRoster(await api.get<Roster>(`/api/care/groups/${groupId}/roster?date=${date}`));
    } catch (e) {
      setRoster(null);
      setRosterError(errText(e));
    }
  }, [groupId, date]);

  useEffect(() => {
    setRoster(null);
    setMode("home");
    try {
      if (groupId) localStorage.setItem(STORE_KEY, groupId);
    } catch {
      /* private mode: the choice just is not remembered */
    }
    void loadRoster();
  }, [groupId, loadRoster]);

  const startCheckIn = () => {
    setPicked(new Set((roster?.members ?? []).filter((m) => isPresent(m.status)).map((m) => m.id)));
    setMode("checkin");
  };
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const save = async () => {
    if (!roster) return;
    setSaving(true);
    try {
      await api.post("/api/attendance/bulk", {
        date,
        serviceType: "care_group",
        groupId: roster.group.id,
        records: roster.members.map((m) => ({
          memberId: m.id,
          // someone already marked "ลา" stays "ลา" unless they were tapped as present
          status: picked.has(m.id) ? "present" : m.status === "leave" ? "leave" : "absent",
        })),
      });
      toast.success(`บันทึกแล้ว: มา ${picked.size} จาก ${roster.members.length} คน`);
      setMode("home");
      await loadRoster();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const options = bodies?.flatMap((b) => b.careGroups) ?? [];
  const members = roster?.members ?? [];
  const marked = members.some((m) => m.status !== null);
  const cameToday = members.filter((m) => isPresent(m.status)).length;
  const toCall = members.filter((m) => m.missed >= FOLLOW_UP_AFTER).sort((a, b) => b.missed - a.missed);
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });

  return (
    <AppLayout>
      <PageHeader title="เช็คชื่อพันธกิจ" description={`${dateLabel} · แตะชื่อคนที่มา แล้วกดบันทึก`} />

      {bodiesError ? (
        <ErrorState title="โหลดรายชื่อพันธกิจไม่สำเร็จ" description="หน้านี้ใช้ได้เฉพาะเจ้าหน้าที่และหัวหน้ากลุ่ม ลองใหม่อีกครั้ง" technical={bodiesError} />
      ) : !bodies ? (
        <div role="status" aria-label="กำลังโหลดพันธกิจ">
          <ListSkeleton count={4} />
        </div>
      ) : options.length === 0 ? (
        <EmptyState icon={Users} title="ยังไม่มีพันธกิจในระบบ" description="สร้างพันธกิจที่หน้ากลุ่ม หรือโหลดข้อมูลผังองค์กรที่หน้านำเข้าจาก Excel" />
      ) : (
        <div className="clay-screen">
          {options.length > 1 && (
            <div>
              <label htmlFor="care-group" className="type-caption-strong block text-[var(--color-ink)]">
                พันธกิจ
              </label>
              <select
                id="care-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="clay-chip mt-1.5 w-full appearance-none pr-4"
              >
                {bodies.map((b) => (
                  <optgroup key={b.name} label={b.name}>
                    {b.careGroups.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.trim()}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {rosterError ? (
            <ErrorState title="โหลดรายชื่อพันธกิจไม่สำเร็จ" description="ลองอีกครั้ง" technical={rosterError} onRetry={() => void loadRoster()} />
          ) : !roster ? (
            <div role="status" aria-label="กำลังโหลดรายชื่อ">
              <ListSkeleton count={4} />
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="ยังไม่มีสมาชิกในพันธกิจนี้"
              description="เพิ่มสมาชิกเข้าพันธกิจที่หน้าสมาชิก แล้วกลับมาเช็คชื่อ"
              action={{ label: "ไปหน้าสมาชิก", href: "/members" }}
            />
          ) : mode === "checkin" ? (
            <>
              <section aria-labelledby="ci-title" className="flex flex-col gap-3">
                <div>
                  <p className="type-caption-strong text-[var(--color-primary)]">
                    {roster.group.name}
                    {roster.group.bodyName ? ` · ${roster.group.bodyName}` : ""}
                  </p>
                  <h2 id="ci-title" className="type-lead font-semibold text-[var(--color-ink)]">
                    ใครมาบ้าง
                  </h2>
                </div>
                <div className="flex items-baseline gap-3">
                  <b className="type-body-strong tabular-nums" style={{ fontSize: 20 }}>
                    มา {picked.size} / {members.length}
                  </b>
                  <span className="type-caption ml-auto text-[var(--color-body-muted)]">แตะอีกครั้งเพื่อยกเลิก</span>
                </div>
                <div
                  className="clay-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={members.length}
                  aria-valuenow={picked.size}
                  aria-label="จำนวนคนที่มา"
                >
                  <i style={{ width: `${(picked.size / members.length) * 100}%` }} />
                </div>
              </section>
              <ul className="flex flex-col gap-3">
                {members.map((m) => (
                  <li key={m.id}>
                    <button type="button" className="clay-tile" aria-pressed={picked.has(m.id)} onClick={() => toggle(m.id)}>
                      <span className="clay-tick">
                        <Check size={20} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="type-body-strong block truncate">{label(m)}</span>
                        {m.nickname && m.name !== m.nickname && <span className="type-caption block truncate opacity-80">{m.name}</span>}
                      </span>
                      {m.status === "leave" && !picked.has(m.id) && <span className="clay-tag butter">ลา</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="sticky bottom-14 z-10 -mx-1 flex flex-col gap-2 bg-[var(--clay-ground)] px-1 py-3 lg:bottom-0">
                <button type="button" className="clay-btn w-full" onClick={() => void save()} disabled={saving}>
                  <Check size={20} aria-hidden="true" />
                  {saving ? "กำลังบันทึก…" : "บันทึกการเช็คชื่อ"}
                </button>
                <button type="button" className="clay-chip self-center" onClick={() => setMode("home")} disabled={saving}>
                  ยกเลิก
                </button>
              </div>
            </>
          ) : (
            <>
              <section className="clay-card flex flex-col gap-3" aria-labelledby="home-title">
                <p className="type-caption-strong text-[var(--color-primary)]">
                  {roster.group.bodyName ?? "พันธกิจ"}
                  {roster.group.careLeaderName ? ` · หนค. ${roster.group.careLeaderName}` : ""}
                </p>
                <h2 id="home-title" className="type-lead font-semibold text-[var(--color-ink)]">
                  {roster.group.name}
                </h2>
                {marked ? (
                  <p className="type-body">
                    <span className="clay-tag">เช็คชื่อวันนี้แล้ว</span>{" "}
                    <span className="tabular-nums">
                      มา {cameToday} จาก {members.length} คน
                    </span>
                  </p>
                ) : (
                  <p className="type-body text-[var(--color-body-muted)]">สมาชิกในพันธกิจ {members.length} คน ยังไม่ได้เช็คชื่อวันนี้</p>
                )}
                <button type="button" className="clay-btn w-full" onClick={startCheckIn}>
                  <ListChecks size={20} aria-hidden="true" />
                  {marked ? "แก้ไขการเช็คชื่อ" : "เริ่มเช็คชื่อ"}
                </button>
              </section>

              <section aria-labelledby="call-title" className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <h2 id="call-title" className="type-body-strong flex-1 text-[var(--color-ink)]">
                    ควรโทรหา
                  </h2>
                  {toCall.length > 0 && <span className="clay-tag peach tabular-nums">{toCall.length} คน</span>}
                </div>
                {roster.sessions.length === 0 ? (
                  <p className="clay-card-soft type-caption text-[var(--color-body-muted)]">ยังไม่มีประวัติการเช็คชื่อของพันธกิจนี้ พอเช็คชื่อครบ 2 ครั้ง รายชื่อคนที่ขาดจะขึ้นที่นี่</p>
                ) : toCall.length === 0 ? (
                  <p className="clay-card-soft type-caption text-[var(--color-body-muted)]">ไม่มีใครขาดติดกัน {FOLLOW_UP_AFTER} ครั้งขึ้นไป</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {toCall.map((m) => (
                      <li key={m.id} className="clay-card-soft flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <span className="clay-badge peach" aria-hidden="true">
                            {Array.from(label(m))[0]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="type-body-strong truncate">{label(m)}</p>
                            <p className="type-caption tabular-nums text-[var(--color-body-muted)]">ไม่มา {m.missed} ครั้งติด</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {m.phone ? (
                            <a className="clay-chip" href={`tel:${m.phone}`}>
                              <Phone size={18} aria-hidden="true" />
                              โทร {m.phone}
                            </a>
                          ) : (
                            <span className="type-caption self-center text-[var(--color-body-muted)]">ยังไม่มีเบอร์โทร</span>
                          )}
                          {m.lineId && (
                            <a className="clay-chip" href={`https://line.me/ti/p/~${encodeURIComponent(m.lineId)}`} target="_blank" rel="noreferrer">
                              <MessageCircle size={18} aria-hidden="true" />
                              LINE
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}
