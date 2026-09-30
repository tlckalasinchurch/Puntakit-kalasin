/// <reference types="leaflet.markercluster" />
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ListTree, MapPin, RotateCw, Users } from "lucide-react";
import { Link } from "wouter";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { api, ApiError } from "@/lib/api";

// Same labels the Groups page uses, so a group reads the same way everywhere.
const CATEGORY_LABELS: Record<string, string> = {
  cell: "กลุ่มเซลล์ทั่วไป",
  bible_study: "กลุ่มศึกษาพระคัมภีร์",
  prayer: "กลุ่มอธิษฐาน",
  youth: "กลุ่มเยาวชน/นักศึกษา",
  kids: "กลุ่มเด็ก",
  family: "กลุ่มครอบครัว",
  men: "กลุ่มผู้ชาย",
  women: "กลุ่มผู้หญิง",
  volunteer: "กลุ่มอาสาสมัคร",
  online: "กลุ่มออนไลน์",
  ministry: "พันธกิจ",
  fellowship: "กลุ่มสามัคคีธรรม",
  general: "กลุ่มทั่วไป",
  other: "อื่น ๆ",
};

const STATUS_LABELS: Record<
  string,
  { label: string; tone: "success" | "warning" | "neutral" }
> = {
  active: { label: "เปิดดำเนินการ", tone: "success" },
  paused: { label: "พักชั่วคราว", tone: "warning" },
  closed: { label: "ปิดกลุ่ม", tone: "neutral" },
};

// Chalasin, Thailand — used only to center the map when no group has coordinates yet.
const FALLBACK_CENTER: L.LatLngLiteral = { lat: 16.4322, lng: 103.5061 };

// A visible V2-styled dot wrapped in an invisible, larger hit area so the marker
// reads as a normal map pin but still meets the 44px touch-target minimum.
const PIN_HIT_SIZE = 44;

function pinHtml({
  visibleSize,
  label,
}: {
  visibleSize: number;
  label?: string;
}) {
  const hitSize = Math.max(PIN_HIT_SIZE, visibleSize);
  const fontSize = visibleSize >= 40 ? 13 : 11;
  // Plain inline styles, not Tailwind classes: this HTML string is handed to
  // Leaflet, which mounts it outside Tailwind's stylesheet scan. CSS custom
  // properties still cascade to it normally since it's appended into the
  // page's DOM tree.
  return `
    <div style="width:${hitSize}px;height:${hitSize}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="width:${visibleSize}px;height:${visibleSize}px;border-radius:var(--radius-circle);background:var(--color-primary);border:2px solid var(--color-on-dark);box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:var(--color-on-dark);font-family:'Prompt',system-ui,sans-serif;font-weight:600;font-size:${fontSize}px;line-height:1;">
        ${label ?? ""}
      </div>
    </div>
  `;
}

function pinDivIcon(options: { visibleSize: number; label?: string }) {
  const hitSize = Math.max(PIN_HIT_SIZE, options.visibleSize);
  return L.divIcon({
    html: pinHtml(options),
    className: "", // clear Leaflet's default divIcon class (white box + border)
    iconSize: [hitSize, hitSize],
    iconAnchor: [hitSize / 2, hitSize / 2],
  });
}

// Custom cluster icon so clusters use V2 tokens instead of a generic plugin look.
function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const label = count > 99 ? "99+" : String(count);
  const visibleSize = Math.min(56, 32 + Math.log2(count) * 6);
  return pinDivIcon({ visibleSize, label });
}

interface MapGroup {
  id: string;
  name: string;
  category: string;
  status: string;
  privacy: string;
  area: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingLocation: string | null;
  latitude: string | null;
  longitude: string | null;
  memberCount: number;
  leaderName: string | null;
  description: string | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: MapGroup[] };

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? {
    label: status,
    tone: "neutral" as const,
  };
  const toneClass =
    cfg.tone === "success"
      ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
      : cfg.tone === "warning"
        ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
        : "bg-[var(--color-canvas-soft)] text-[var(--color-body-muted)]";
  return (
    <span
      className={`type-fine shrink-0 rounded-[var(--radius-xs)] px-2 py-1 font-semibold ${toneClass}`}
    >
      {cfg.label}
    </span>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`type-caption-strong h-11 shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] px-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] ${
        active
          ? "bg-[var(--color-primary)] text-white"
          : "border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-body-muted)] hover:bg-[var(--color-canvas-soft)]"
      }`}
    >
      {label}
    </button>
  );
}

function GroupDetailBody({ group }: { group: MapGroup }) {
  const schedule = [group.meetingDay, group.meetingTime]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={group.status} />
        <span className="type-caption text-[var(--color-body-muted)]">
          {CATEGORY_LABELS[group.category] ?? group.category}
        </span>
      </div>
      {group.description && (
        <p className="type-body text-[var(--color-ink)]">{group.description}</p>
      )}
      <dl className="space-y-2">
        {group.area && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="type-caption text-[var(--color-body-muted)]">
              พื้นที่
            </dt>
            <dd className="type-caption-strong text-[var(--color-ink)]">
              {group.area}
            </dd>
          </div>
        )}
        {group.leaderName && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="type-caption text-[var(--color-body-muted)]">
              ผู้นำกลุ่ม
            </dt>
            <dd className="type-caption-strong text-[var(--color-ink)]">
              {group.leaderName}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4">
          <dt className="type-caption text-[var(--color-body-muted)]">
            สมาชิก
          </dt>
          <dd className="type-caption-strong text-[var(--color-ink)]">
            {group.memberCount.toLocaleString("th-TH")} คน
          </dd>
        </div>
        {schedule && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="type-caption text-[var(--color-body-muted)]">
              เวลานัดพบ
            </dt>
            <dd className="type-caption-strong text-right text-[var(--color-ink)]">
              {schedule}
            </dd>
          </div>
        )}
        {group.meetingLocation && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="type-caption shrink-0 text-[var(--color-body-muted)]">
              สถานที่
            </dt>
            <dd className="type-caption-strong text-right text-[var(--color-ink)]">
              {group.meetingLocation}
            </dd>
          </div>
        )}
      </dl>
      <Button asChild className="w-full">
        <Link href="/groups">ดูรายละเอียดกลุ่มแคร์</Link>
      </Button>
    </div>
  );
}

export default function MapPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const [selectedGroup, setSelectedGroup] = useState<MapGroup | null>(null);
  // Toggling to list view unmounts <MapView>; switching back mounts a fresh map
  // instance. An incrementing id (not a boolean) makes the marker effect below
  // re-run on every such remount, not just the first one.
  const [mapInstanceId, setMapInstanceId] = useState(0);
  const markersRef = useRef<L.Marker[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    api.get<MapGroup[]>("/api/groups?limit=100").then(
      data => {
        if (active) setState({ status: "success", data });
      },
      err => {
        if (active) {
          setState({
            status: "error",
            message:
              err instanceof ApiError
                ? err.message
                : "โหลดข้อมูลกลุ่มแคร์ไม่สำเร็จ",
          });
        }
      }
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const groups = state.status === "success" ? state.data : [];

  const categoriesInUse = useMemo(() => {
    const seen = new Set<string>();
    for (const g of groups) seen.add(g.category);
    return Array.from(seen);
  }, [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter(g => {
      if (category && g.category !== category) return false;
      if (!q) return true;
      return (
        g.name.toLowerCase().includes(q) ||
        (g.area ?? "").toLowerCase().includes(q) ||
        (g.meetingLocation ?? "").toLowerCase().includes(q)
      );
    });
  }, [groups, category, query]);

  const withCoordinates = useMemo(
    () => filtered.filter(g => g.latitude && g.longitude),
    [filtered]
  );
  const withoutCoordinates = filtered.length - withCoordinates.length;

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    // zoomToBoundsOnClick defaults to true, which is exactly the "click a
    // cluster to zoom/fit into its area" behavior.
    const clusterGroup = L.markerClusterGroup({
      iconCreateFunction: createClusterIcon,
    });
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
    setMapInstanceId(id => id + 1);
  }, []);

  // Redraw markers whenever the map (re)mounts or the filtered set changes.
  // mapInstanceId (not mapRef, a ref, which wouldn't trigger a re-run) makes this
  // fire correctly regardless of whether the data or the map instance arrives first.
  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;

    clusterGroup.clearLayers();
    markersRef.current = [];

    const newMarkers: L.Marker[] = [];

    for (const group of withCoordinates) {
      const lat = Number(group.latitude);
      const lng = Number(group.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const marker = L.marker([lat, lng], {
        icon: pinDivIcon({ visibleSize: 28 }),
        title: group.name,
        alt: group.name,
      });
      marker.on("click", () => setSelectedGroup(group));
      newMarkers.push(marker);
    }

    markersRef.current = newMarkers;
    clusterGroup.addLayers(newMarkers);

    if (newMarkers.length > 0) {
      map.fitBounds(L.featureGroup(newMarkers).getBounds(), {
        padding: [64, 64],
      });
    } else {
      map.setView(FALLBACK_CENTER, 11);
    }
  }, [withCoordinates, mapInstanceId]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="type-lead font-semibold text-[var(--color-ink)]">
              แผนที่กลุ่มแคร์
            </h1>
            <p className="type-caption mt-1 text-[var(--color-body-muted)]">
              ตำแหน่งกลุ่มแคร์ที่มีพิกัดในระบบ
            </p>
          </div>
          <div
            role="group"
            aria-label="สลับมุมมองแผนที่หรือรายการ"
            className="inline-flex h-11 shrink-0 self-start overflow-hidden rounded-[var(--radius-pill)] border border-[var(--color-hairline)] sm:self-auto"
          >
            <button
              type="button"
              onClick={() => setView("map")}
              aria-pressed={view === "map"}
              className={`type-caption-strong flex h-11 items-center gap-1.5 px-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] ${
                view === "map"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-body-muted)]"
              }`}
            >
              <MapPin size={ICON_SIZE.sm} aria-hidden="true" />
              แผนที่
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`type-caption-strong flex h-11 items-center gap-1.5 px-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] ${
                view === "list"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-body-muted)]"
              }`}
            >
              <ListTree size={ICON_SIZE.sm} aria-hidden="true" />
              รายการ
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ค้นหากลุ่มด้วยชื่อ พื้นที่ หรือสถานที่นัดพบ"
            aria-label="ค้นหากลุ่มแคร์"
            className="rounded-[var(--radius-pill)] bg-[var(--color-canvas)]"
          />
          {categoriesInUse.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <CategoryChip
                label="ทั้งหมด"
                active={category === null}
                onClick={() => setCategory(null)}
              />
              {categoriesInUse.map(c => (
                <CategoryChip
                  key={c}
                  label={CATEGORY_LABELS[c] ?? c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
          )}
        </div>

        {state.status === "loading" && (
          <div role="status" aria-label="กำลังโหลดข้อมูลกลุ่มแคร์">
            <Skeleton className="h-[420px] w-full rounded-[var(--radius-lg)]" />
          </div>
        )}

        {state.status === "error" && (
          <div
            role="alert"
            className="flex flex-col items-start gap-4 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                size={ICON_SIZE.lg}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--color-error)]"
              />
              <div>
                <p className="type-body-strong text-[var(--color-ink)]">
                  โหลดข้อมูลกลุ่มแคร์ไม่สำเร็จ
                </p>
                <p className="type-caption text-[var(--color-body-muted)]">
                  {state.message}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setAttempt(n => n + 1)}>
              <RotateCw aria-hidden="true" />
              ลองใหม่
            </Button>
          </div>
        )}

        {state.status === "success" && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-6 py-12 text-center">
            <Users
              size={ICON_SIZE["2xl"]}
              aria-hidden="true"
              className="text-[var(--color-body-muted)]"
            />
            <p className="type-body-strong text-[var(--color-ink)]">
              ไม่พบกลุ่มแคร์ที่ตรงกับตัวกรอง
            </p>
            <p className="type-caption max-w-sm text-[var(--color-body-muted)]">
              ลองล้างคำค้นหรือเลือก "ทั้งหมด" เพื่อดูกลุ่มแคร์ทุกประเภท
            </p>
          </div>
        )}

        {state.status === "success" && filtered.length > 0 && (
          <>
            {view === "map" && (
              <>
                <MapView
                  className="h-[420px] rounded-[var(--radius-lg)] border border-[var(--color-hairline)] sm:h-[520px]"
                  initialCenter={FALLBACK_CENTER}
                  initialZoom={11}
                  onMapReady={handleMapReady}
                />
                {withoutCoordinates > 0 && (
                  <p className="type-caption text-[var(--color-body-muted)]">
                    มี {withoutCoordinates.toLocaleString("th-TH")}{" "}
                    กลุ่มที่ยังไม่ได้ระบุพิกัด —
                    สลับไปมุมมองรายการเพื่อดูทั้งหมด
                  </p>
                )}
              </>
            )}

            {view === "list" && (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(group => (
                  <li key={group.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedGroup(group)}
                      className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] rounded-[var(--radius-lg)]"
                    >
                      <Card className="h-full gap-2 px-6 transition-colors hover:bg-[var(--color-canvas-soft)]">
                        <div className="flex items-start justify-between gap-2">
                          <p className="type-body-strong text-[var(--color-ink)]">
                            {group.name}
                          </p>
                          <StatusChip status={group.status} />
                        </div>
                        <p className="type-caption text-[var(--color-body-muted)]">
                          {CATEGORY_LABELS[group.category] ?? group.category}
                        </p>
                        <p className="type-caption flex items-center gap-1.5 text-[var(--color-body-muted)]">
                          <MapPin
                            size={ICON_SIZE.xs}
                            aria-hidden="true"
                            className="shrink-0"
                          />
                          {group.meetingLocation ||
                            group.area ||
                            "ยังไม่ระบุสถานที่"}
                        </p>
                        <p className="type-caption text-[var(--color-body-muted)]">
                          {group.memberCount.toLocaleString("th-TH")} คน
                          {!group.latitude && " · ไม่มีพิกัดบนแผนที่"}
                        </p>
                      </Card>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Sheet
        open={!!selectedGroup}
        onOpenChange={open => !open && setSelectedGroup(null)}
      >
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-lg)]"
        >
          {selectedGroup && (
            <>
              <SheetHeader>
                <SheetTitle className="type-lead text-[var(--color-ink)]">
                  {selectedGroup.name}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  รายละเอียดกลุ่มแคร์ {selectedGroup.name}
                </SheetDescription>
              </SheetHeader>
              <GroupDetailBody group={selectedGroup} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
