import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, MapPin } from "lucide-react";
import { MapView, type Basemap } from "@/components/Map";
import { BasemapToggle } from "@/components/map/BasemapToggle";
import { pinDivIcon } from "@/components/map/pins";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCoordinate, KALASIN_CENTER, parseCoordinates, type LatLng } from "@/lib/geo";
import { ICON_SIZE } from "@/lib/icon-sizes";

interface LocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The coordinates already on record, if any. */
  initial: LatLng | null;
  confirmLabel?: string;
  /** Receives the chosen point. Throw to keep the dialog open (the caller reports why). */
  onConfirm: (point: LatLng) => Promise<void> | void;
}

const PIN_COLOR = "#e8560a";

/** Human-readable reasons a phone could not give us its position. */
function geolocationMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง — เปิดสิทธิ์ตำแหน่งให้เบราว์เซอร์ หรือปักหมุดบนแผนที่เอง";
  if (error.code === error.TIMEOUT) return "หาตำแหน่งไม่ทันเวลา ลองอีกครั้ง หรือปักหมุดบนแผนที่เอง";
  return "อุปกรณ์ยังหาตำแหน่งไม่ได้ ลองอีกครั้ง หรือปักหมุดบนแผนที่เอง";
}

/**
 * Pin a real location three ways: the phone's GPS, a tap or drag on the map,
 * or a pasted Google Maps link / "lat, lng" text. Nothing is saved here; the
 * chosen point goes to `onConfirm`.
 */
export function LocationPicker({ open, onOpenChange, title, initial, confirmLabel = "บันทึกพิกัด", onConfirm }: LocationPickerProps) {
  const { theme } = useTheme();
  const [basemap, setBasemap] = useState<Basemap>("street");
  const [point, setPoint] = useState<LatLng | null>(initial);
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const appliedPaste = useRef("");

  // A fresh start each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPoint(initial);
    setPaste("");
    appliedPaste.current = "";
    setMessage(null);
    setBasemap("street");
  }, [open, initial]);

  /** Put (or move) the pin; `recenter` also pans the map to it. */
  const place = useCallback((next: LatLng, recenter: boolean) => {
    setPoint(next);
    setMessage(null);
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      const marker = L.marker(next, { icon: pinDivIcon({ visibleSize: 30, color: PIN_COLOR }), draggable: true, title: "ลากเพื่อปรับตำแหน่ง", alt: "หมุดตำแหน่งพันธกิจ" });
      marker.on("dragend", () => {
        const at = marker.getLatLng();
        setPoint({ lat: at.lat, lng: at.lng });
      });
      marker.addTo(map);
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(next);
    }
    if (recenter) map.setView(next, Math.max(map.getZoom(), 16));
  }, []);

  const handleMapReady = useCallback(
    (map: L.Map) => {
      mapRef.current = map;
      markerRef.current = null;
      map.on("click", (event: L.LeafletMouseEvent) => place({ lat: event.latlng.lat, lng: event.latlng.lng }, false));
      // The dialog animates in, so the container is not final size yet.
      window.setTimeout(() => map.invalidateSize(), 120);
      if (initial) {
        map.setView(initial, 16);
        place(initial, false);
      }
    },
    // The map is created once per open; `initial` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [place]
  );

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setMessage({ tone: "error", text: "เบราว์เซอร์นี้ไม่รองรับการดึงตำแหน่ง ปักหมุดบนแผนที่หรือวางพิกัดแทน" });
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        place({ lat: position.coords.latitude, lng: position.coords.longitude }, true);
        setMessage({ tone: "info", text: `ได้ตำแหน่งแล้ว (คลาดเคลื่อนประมาณ ${Math.round(position.coords.accuracy)} เมตร) ลากหมุดเพื่อปรับได้` });
      },
      (error) => {
        setLocating(false);
        setMessage({ tone: "error", text: geolocationMessage(error) });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const applyPaste = (value: string) => {
    // Once per distinct text: a blur after the user dragged the pin must not snap it back.
    if (!value.trim() || value === appliedPaste.current) return;
    appliedPaste.current = value;
    const parsed = parseCoordinates(value);
    if (parsed) {
      place(parsed, true);
      return;
    }
    const isShortLink = /goo\.gl|maps\.app/i.test(value);
    setMessage({
      tone: "error",
      text: isShortLink
        ? "ลิงก์แบบย่อ (maps.app.goo.gl) อ่านพิกัดไม่ได้ เปิดลิงก์ก่อน แล้วคัดลอกลิงก์เต็มหรือพิกัดมาวาง"
        : "อ่านพิกัดจากข้อความนี้ไม่ได้ วางลิงก์ Google Maps แบบเต็ม หรือพิมพ์เช่น 16.4322, 103.5061",
    });
  };

  const confirm = async () => {
    if (!point) return;
    setSaving(true);
    try {
      await onConfirm(point);
      onOpenChange(false);
    } catch {
      /* the caller already told the user why; keep the dialog open */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[min(100vw-1.5rem,40rem)] max-w-none gap-4 overflow-y-auto rounded-[var(--radius-card)] p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="type-lead text-[var(--color-ink)]">{title}</DialogTitle>
          <DialogDescription className="type-caption text-[var(--color-body-muted)]">
            ปักหมุดตำแหน่งจริงด้วยวิธีใดก็ได้: ใช้ตำแหน่งปัจจุบัน แตะหรือลากบนแผนที่ หรือวางลิงก์ Google Maps
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} className="shrink-0">
            <LocateFixed size={ICON_SIZE.sm} aria-hidden="true" />
            {locating ? "กำลังหาตำแหน่ง…" : "ดึงพิกัดปัจจุบันของฉัน"}
          </Button>
          <label className="min-w-0 flex-1">
            <span className="type-caption-strong mb-1 block text-[var(--color-ink)]">วางลิงก์ Google Maps หรือพิกัด</span>
            <input
              value={paste}
              onChange={(event) => setPaste(event.target.value)}
              onPaste={(event) => {
                // Read the pasted text directly: state has not caught up yet.
                const text = event.clipboardData.getData("text");
                window.setTimeout(() => applyPaste(text), 0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyPaste(paste);
                }
              }}
              onBlur={() => applyPaste(paste)}
              inputMode="text"
              autoComplete="off"
              placeholder="16.4322, 103.5061"
              aria-describedby="picker-message"
              className="h-11 w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-surface)] px-4 text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            />
          </label>
        </div>

        <div className="relative">
          <MapView
            className="h-[300px] rounded-[var(--radius-tile)] border border-[var(--color-hairline)] sm:h-[360px]"
            initialCenter={initial ?? KALASIN_CENTER}
            initialZoom={initial ? 16 : 11}
            basemap={basemap}
            theme={theme}
            onMapReady={handleMapReady}
          />
          <BasemapToggle value={basemap} onChange={setBasemap} />
        </div>

        <p id="picker-message" role={message?.tone === "error" ? "alert" : "status"} aria-live="polite" className={`type-caption min-h-[1.25rem] ${message?.tone === "error" ? "font-semibold text-[var(--color-error-ink)]" : "text-[var(--color-body-muted)]"}`}>
          {message?.text ?? (point ? "" : "แตะบนแผนที่เพื่อปักหมุด")}
        </p>

        <p className="type-body-strong flex items-center gap-2 text-[var(--color-ink)]" data-testid="picker-readout">
          <MapPin size={ICON_SIZE.sm} aria-hidden="true" className="text-[var(--color-primary-ink)]" />
          {point ? (
            <span className="tabular-nums">
              ละติจูด {formatCoordinate(point.lat)} · ลองจิจูด {formatCoordinate(point.lng)}
            </span>
          ) : (
            <span className="text-[var(--color-body-muted)]">ยังไม่ได้ปักหมุด</span>
          )}
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={!point || saving}>
            {saving ? "กำลังบันทึก…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
